//SPDX-License-Identifier: MIT
pragma solidity 0.4.24;
pragma experimental ABIEncoderV2;

import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import "../BasePaymaster.sol";
import "./IUniswapV2Router02.sol";
import "../../upgradeable_contracts/GSNForeignERC20Bridge.sol";
import "../../upgradeable_contracts/Claimable.sol";

contract TokenPaymaster is BasePaymaster, Claimable {
    ERC20 private token;
    IUniswapV2Router02 private router;
    address private bridge;

    address[] private tokenWethPair = new address[](2);
    uint256 public postGasUsage = 300000;
    // Default value from BasePaymaster, may be changed later
    // if we need to increase number of signatures for bridge contract
    uint256 public calldataSizeLimit = 10500;

    constructor(address _relayHub, address _forwarder, address _token, address _router, address _bridge) public {
        _setOwner(msg.sender);
        setRelayHub(IRelayHub(_relayHub));
        setTrustedForwarder(_forwarder);

        token = ERC20(_token);
        router = IUniswapV2Router02(_router);
        bridge = _bridge;

        tokenWethPair[0] = token;
        tokenWethPair[1] = router.WETH();
    }

    function setToken(address t) external onlyOwner {
        token = ERC20(t);
    }

    function setRouter(IUniswapV2Router02 r) external onlyOwner {
        router = r;
    }

    function setBridge(address b) external onlyOwner {
        bridge = b;
    }

    function setPostGasUsage(uint256 gasUsage) external onlyOwner {
        postGasUsage = gasUsage;
    }

    function setCalldataSizeLimit(uint256 sizeLimit) external onlyOwner {
        calldataSizeLimit = sizeLimit;
    }

    function versionPaymaster() external view returns (string memory) {
        return "2.2.0+opengsn.bridgetokengsn.ipaymaster";
    }

    function deposit() external payable {
        require(address(relayHub) != address(0), "relay hub address not set");
        relayHub.depositFor.value(msg.value)(address(this));
    }

    function getGasAndDataLimits() external view returns (IPaymaster.GasAndDataLimits memory limits) {
        return
            IPaymaster.GasAndDataLimits(
                PAYMASTER_ACCEPTANCE_BUDGET,
                PRE_RELAYED_CALL_GAS_LIMIT,
                postGasUsage, // maximum postRelayedCall gasLimit
                calldataSizeLimit
            );
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
    ) public relayHubOnly returns (bytes memory context, bool revertOnRecipientRevert) {
        (signature, approvalData);
        _verifyForwarder(relayRequest);
        bytes memory reqData = relayRequest.request.data;
        // Verify that `executeSignaturesGSN` is called
        bytes4 functionSelector;
        assembly {
            functionSelector := mload(add(reqData, 32))
        }
        require(bridge == relayRequest.request.to, "accepts only bridge calls");
        require(functionSelector == GSNForeignERC20Bridge(bridge).executeSignaturesGSN.selector, "not allowed target");

        // Get 3rd argument of executeSignaturesGSN, i.e. maxTokensFee
        uint256 maxTokensFee = uint256(readBytes32(reqData, 4 + 32 + 32));
        uint256 potentialWeiIncome = router.getAmountsOut(maxTokensFee, tokenWethPair)[1];
        uint256 maxFee = relayHub.calculateCharge(maxPossibleGas, relayRequest.relayData);
        require(potentialWeiIncome >= maxFee, "tokens fee can't cover expenses");

        // Recipient should match the sender
        uint256 msgIdx = uint256(readBytes32(reqData, 4));
        address recipient = address(readBytes32(reqData, 4 + msgIdx + 20));
        require(recipient == relayRequest.request.from, "sender does not match recipient");
        return (abi.encodePacked(relayRequest.request.from, maxPossibleGas, maxTokensFee), true);
    }

    function min(uint256 a, uint256 b) private pure returns (uint256) {
        return a < b ? a : b;
    }

    function postRelayedCall(bytes context, bool success, uint256 gasUseWithoutPost, GsnTypes.RelayData relayData)
        public
        relayHubOnly
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
        require(token.approve(address(router), maxTokensFee), "approve failed");
        // NOTE: Received eth automatically converts to relayhub deposit
        uint256 spentTokens = router.swapTokensForExactETH(
            chargeWei,
            maxTokensFee,
            tokenWethPair,
            address(this),
            block.timestamp
        )[0];

        // Send rest of tokens to user
        if (spentTokens < maxTokensFee) {
            require(token.transfer(to, maxTokensFee - spentTokens));
        }
    }

    function claimTokens(address _token, address _to) external onlyOwner {
        claimValues(_token, _to);
    }
}
