pragma solidity 0.4.24;

import "./HomeBridgeNativeToErc.sol";
import "../RelativeExecutionDailyLimit.sol";

contract HomeBridgeNativeToErcRelativeDailyLimit is HomeBridgeNativeToErc, RelativeExecutionDailyLimit {
    function _getTokenBalance() internal view returns (uint256) {
        return address(this).balance;
    }
}
