pragma solidity 0.4.24;

import "./HomeBridgeNativeToErc.sol";
import "../RelativeDailyLimit.sol";

contract HomeBridgeNativeToErcRelativeDailyLimit is HomeBridgeNativeToErc, RelativeDailyLimit {
    function _getTokenBalance() internal view returns (uint256) {
        return address(this).balance;
    }
}
