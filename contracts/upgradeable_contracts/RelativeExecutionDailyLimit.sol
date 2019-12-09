pragma solidity 0.4.24;

import "./BasicRelativeDailyLimit.sol";

contract RelativeExecutionDailyLimit is BasicRelativeDailyLimit {
    function _minPerTx() internal view returns (uint256) {
        return executionMinPerTx();
    }

    function executionDailyLimit() public view returns (uint256) {
        return _getTodayLimit();
    }

    function setExecutionMinPerTx(uint256 _minPerTx) external {
        require(_minPerTx < executionMaxPerTx());
        uintStorage[EXECUTION_MIN_PER_TX] = _minPerTx;
    }

    function setExecutionMaxPerTx(uint256 _maxPerTx) external {
        require(_maxPerTx > executionMinPerTx() || _maxPerTx == 0);
        uintStorage[EXECUTION_MAX_PER_TX] = _maxPerTx;
    }
}
