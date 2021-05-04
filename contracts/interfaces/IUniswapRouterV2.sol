pragma solidity 0.4.24;

interface IUniswapRouterV2 {
    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] path,
        address to,
        uint256 deadline
    ) external returns (uint256[] amounts);
    function swapExactTokensForETH(uint256 amountIn, uint256 amountOutMin, address[] path, address to, uint256 deadline)
        external
        returns (uint256[] amounts);
    function getAmountsOut(uint256 amountIn, address[] path) external view returns (uint256[] memory amounts);
}
