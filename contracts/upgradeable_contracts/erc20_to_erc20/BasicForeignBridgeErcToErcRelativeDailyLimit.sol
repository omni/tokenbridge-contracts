pragma solidity 0.4.24;

import "./BasicForeignBridgeErcToErc.sol";
import "../RelativeExecutionDailyLimit.sol";

contract BasicForeignBridgeErcToErcRelativeDailyLimit is BasicForeignBridgeErcToErc, RelativeExecutionDailyLimit {
    function _getTokenBalance() internal view returns (uint256) {
        return erc20token().balanceOf(address(this));
    }
}
