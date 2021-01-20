//SPDX-License-Identifier: MIT
pragma solidity 0.4.24;
pragma experimental ABIEncoderV2;

import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import "../BasePaymaster.sol";
import "./IUniswapRouter02.sol";

contract TokenPaymaster is BasePaymaster {
    address private token;

    IUniswapV2Router02 private router;
    address[] private TokenWethPair = new address[](2);

    uint256 public postGasUsage = 300000;

    constructor(address rh, address fw, address _token, IUniswapV2Router02 _router) public {
        setRelayHub(IRelayHub(rh));
        setTrustedForwarder(IForwarder(fw));

        token = _token;
        router = _router;

        TokenWethPair[0] = token;
        TokenWethPair[1] = router.WETH();
    }

    function setRouter(IUniswapV2Router02 r) public onlyOwner {
        router = r;
    }

    function setToken(address t) public onlyOwner {
        token = t;
    }

    function versionPaymaster() external view returns (string memory) {
        return "2.0.0+opengsn.tokengsn.ipaymaster";
    }

    function() external payable {
        require(address(relayHub) != address(0), "relay hub address not set");
        relayHub.depositFor.value(msg.value)(address(this));
    }

    function deposit() external payable {
        require(address(relayHub) != address(0), "relay hub address not set");
        relayHub.depositFor.value(msg.value)(address(this));
    }

    function getGasLimits() external view returns (IPaymaster.GasLimits memory limits) {
        return
            IPaymaster.GasLimits(
                PAYMASTER_ACCEPTANCE_BUDGET,
                PRE_RELAYED_CALL_GAS_LIMIT,
                postGasUsage // maximum postRelayedCall gasLimit
            );
    }

    function erc20() internal view returns (ERC20) {
        return ERC20(token);
    }

    function readBytes32(bytes memory b, uint256 index) internal pure returns (bytes32 res) {
        require(b.length >= index + 32, "data too short");
        assembly {
            res := mload(add(b, add(index, 32)))
        }
    }

    function preRelayedCall(
        GsnTypes.RelayRequest relayRequest,
        bytes signature,
        bytes approvalData,
        uint256 maxPossibleGas
    ) public returns (bytes memory context, bool revertOnRecipientRevert) {
        (signature, approvalData);
        _verifyForwarder(relayRequest);
        // Get 3rd argument of executeSignaturesGSN, i.e. maxTokensFee
        uint256 maxTokensFee = uint256(readBytes32(relayRequest.request.data, 4 + 32 + 32));
        uint256 potentialWeiIncome = router.getAmountsOut(maxTokensFee, TokenWethPair)[1];
        uint256 maxFee = relayHub.calculateCharge(maxPossibleGas, relayRequest.relayData);
        require(potentialWeiIncome >= maxFee, "tokens fee can't cover expenses");

        // Recipient should match the sender
        uint256 msgIdx = uint256(readBytes32(relayRequest.request.data, 4));
        address recipient = address(readBytes32(relayRequest.request.data, 4 + msgIdx + 20));
        require(recipient == relayRequest.request.from, "sender does not match recipient");
        return (abi.encodePacked(relayRequest.request.from, maxPossibleGas, maxTokensFee), true);
    }

    function min(uint256 a, uint256 b) private pure returns (uint256) {
        return a < b ? a : b;
    }

    function setPostGasUsage(uint256 gasUsage) external onlyOwner {
        postGasUsage = gasUsage;
    }

    function postRelayedCall(bytes context, bool success, uint256 gasUseWithoutPost, GsnTypes.RelayData relayData)
        public
    {
        (success);
        // Extract data from context
        address to;
        uint256 maxPossibleGas;
        uint256 maxTokensFee;
        assembly {
            to := shr(96, mload(add(context, 32)))
            maxPossibleGas := mload(add(context, 52))
            maxTokensFee := mload(add(context, 84))
        }

        // Calculate commission
        // We already approved the transaction to use no more than `maxPossibleGas`.
        // With `postGasUsage` variable we can regulate the commission that users will take.
        // If `postGasUsage` is less than the actual gas usage of the `postRelayedCall`
        // the paymaster will lose ETH after each transaction
        // If `postGasUsage` is more than the actual gas usage of the `postRelayedCall`
        // the paymaster will earn ETH after each transaction
        // So, in real case scenario it should be chosen accurately
        uint256 chargeWei = relayHub.calculateCharge(min(gasUseWithoutPost + postGasUsage, maxPossibleGas), relayData);

        // Uniswap
        require(erc20().approve(address(router), maxTokensFee), "approve failed");
        // NOTE: Received eth automatically converts to relayhub deposit
        uint256 spentTokens = router.swapTokensForExactETH(
            chargeWei,
            maxTokensFee,
            TokenWethPair,
            address(this),
            block.timestamp
        )[0];

        // Send rest of tokens to user
        if (spentTokens < maxTokensFee) {
            require(erc20().transfer(to, maxTokensFee - spentTokens));
        }
    }
}
