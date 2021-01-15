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

    constructor(address rh, address fw) public {
        setRelayHub(IRelayHub(rh));
        setTrustedForwarder(IForwarder(fw));
    }

    function setRouter(address r) public onlyOwner {
        router = IUniswapV2Router02(r);
        TokenWethPair[0] = token;
        TokenWethPair[1] = router.WETH();
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
                2000000 // maximum postRelayedCall gasLimit
            );
    }

    function erc20() internal view returns (ERC20) {
        return ERC20(token);
    }

    function readUint256(bytes memory b, uint256 index) internal pure returns (uint256) {
        require(b.length >= index + 32, "data too short");
        bytes32 tmp;
        assembly {
            tmp := mload(add(b, add(index, 32)))
        }
        return uint256(tmp);
    }

    function preRelayedCall(
        GsnTypes.RelayRequest relayRequest,
        bytes signature,
        bytes approvalData,
        uint256 maxPossibleGas
    ) public returns (bytes memory context, bool revertOnRecipientRevert) {
        (signature, approvalData, maxPossibleGas);
        // Get 3rd argument of executeSignaturesGSN, i.e. maxTokensFee
        uint256 maxTokensFee = readUint256(relayRequest.request.data, 4 + 32 + 32);
        uint256 potentialEthIncome = router.getAmountsOut(maxTokensFee, TokenWethPair)[1];
        uint256 gasPrice = relayRequest.relayData.gasPrice;
        uint256 averageGasUsage = 400000;
        uint256 ethfee = gasPrice * averageGasUsage;
        require(potentialEthIncome >= ethfee, "tokens fee can't cover expenses");
        return (abi.encode(relayRequest.request.from), false);
    }

    function postRelayedCall(bytes context, bool success, uint256 gasUseWithoutPost, GsnTypes.RelayData relayData)
        public
    {
        (success);

        // Calculate commission
        uint256 chargeWei = relayHub.calculateCharge(gasUseWithoutPost + 194000, relayData);

        // Uniswap
        uint256 tokenBalanceBefore = erc20().balanceOf(address(this));
        require(erc20().approve(address(router), tokenBalanceBefore), "approve failed");
        // NOTE: Received eth automatically converts to relayhub deposit
        router.swapTokensForExactETH(chargeWei, tokenBalanceBefore, TokenWethPair, address(this), block.timestamp);

        // Extract destination address from context
        bytes memory localContext = context;
        address to;
        assembly {
            to := mload(add(localContext, 32))
        }
        // Send rest of tokens to user
        uint256 tokensLeft = erc20().balanceOf(address(this));
        require(erc20().transfer(to, tokensLeft));
    }
}
