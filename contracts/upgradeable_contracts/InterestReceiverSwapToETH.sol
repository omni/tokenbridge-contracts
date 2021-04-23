pragma solidity 0.4.24;

import "./InterestReceiverBase.sol";

/**
 * @title InterestReceiverSwapToETH
 * @dev This contract is intended to be used together with InterestConnector module of the erc-to-native bridge.
 * Contract receives DAI and COMP tokens. All received tokens are swapped to ETH and kept on this contract.
 * Later, they can be withdrawn by the owner.
 */
contract InterestReceiverSwapToETH is InterestReceiverBase {
    /**
     * @dev Callback function for notifying this contract about received interest.
     * @param _token address of the token contract. Should be COMP or DAI token address.
     */
    function onInterestReceived(address _token) external {
        address[] memory path = new address[](2);
        path[0] = _token;
        path[1] = wethToken;
        uint256 amount = ERC20(_token).balanceOf(address(this));

        // (min received %) * (amount / 1 DAI) * (ETH per 1 DAI)
        uint256 minAmount = (minReceivedFraction * amount * uniswapRouterV2.getAmountsOut(1 ether, path)[1]) / 10**36;

        bytes memory data = abi.encodeWithSelector(
            uniswapRouterV2.swapExactTokensForETH.selector,
            amount,
            minAmount,
            path,
            address(this),
            now
        );
        address(uniswapRouterV2).call(data);
    }

    /**
     * @dev Fallback function for receiving native coins from the Uniswap Router contract when using swapExactTokensForETH.
     */
    function() external payable {}
}
