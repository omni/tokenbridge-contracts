pragma solidity 0.4.24;

import "./BaseRelativeDailyLimit.sol";

contract RelativeDailyLimit is BaseRelativeDailyLimit {
    function _minPerTx() internal view returns (uint256) {
        return minPerTx();
    }

    function dailyLimit() public view returns (uint256) {
        return _getTodayLimit();
    }
}
