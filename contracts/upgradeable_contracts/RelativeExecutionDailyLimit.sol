pragma solidity 0.4.24;

import "./BaseRelativeDailyLimit.sol";

contract RelativeExecutionDailyLimit is BaseRelativeDailyLimit {
    function _minPerTx() internal view returns (uint256) {
        return executionMinPerTx();
    }

    function executionDailyLimit() public view returns (uint256) {
        return _calculateLimit();
    }
}
