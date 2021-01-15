//SPDX-License-Identifier: MIT
pragma solidity 0.4.24;

import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import "../gsn/token_paymaster/TokenPaymaster.sol";

contract UniswapRouterMock {
    function WETH() external view returns (address) {
        return address(this);
    }

    function getAmountsOut(uint256 amountIn, address[] path) external pure returns (uint256[] memory amounts) {
        amounts = new uint256[](2);
        amounts[0] = amountIn;
        amounts[1] = amountIn / 100;
        // 1 wei == 100 tokens
    }

    function swapTokensForExactETH(uint256 amountOut, uint256 amountInMax, address[] path, address to, uint256 deadline)
        external
        returns (uint256[] memory amounts)
    {
        uint256 ethToSend = amountOut;
        uint256 tokensToTake = ethToSend * 100;

        ERC20(path[0]).transferFrom(msg.sender, address(this), tokensToTake);

        TokenPaymaster(msg.sender).deposit.value(ethToSend)();
    }

    function() external payable {}
}
