pragma solidity 0.4.24;

import "./InterestReceiverBase.sol";

/**
 * @title InterestReceiverStakeBuyback
 * @dev This contract is intended to be used together with InterestConnector module of the erc-to-native bridge.
 * Contract receives DAI and COMP tokens. All received tokens are swapped to STAKE token and burnt.
 */
contract InterestReceiverStakeBuyback is InterestReceiverBase {
    ERC20 public constant stakeToken = ERC20(0x0Ae055097C6d159879521C384F1D2123D1f195e6);

    address public constant burnAddress = 0x000000000000000000000000000000000000dEaD;

    /**
     * @dev Callback function for notifying this contract about received interest.
     * @param _token address of the token contract. Should be COMP or DAI token address.
     */
    function onInterestReceived(address _token) external {
        address[] memory path = new address[](3);
        path[0] = _token;
        path[1] = wethToken;
        path[2] = address(stakeToken);
        uint256 amount = ERC20(_token).balanceOf(address(this));

        // (min received %) * (amount / 1 DAI) * (STAKE per 1 DAI)
        uint256 minAmount = (minReceivedFraction * amount * uniswapRouterV2.getAmountsOut(1 ether, path)[2]) / 10**36;

        bytes memory data = abi.encodeWithSelector(
            uniswapRouterV2.swapExactTokensForTokens.selector,
            amount,
            minAmount,
            path,
            burnAddress,
            now
        );
        address(uniswapRouterV2).call(data);
    }
}
