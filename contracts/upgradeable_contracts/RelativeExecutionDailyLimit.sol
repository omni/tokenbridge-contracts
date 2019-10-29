pragma solidity 0.4.24;

import "./BaseRelativeDailyLimit.sol";

contract RelativeExecutionDailyLimit is BaseRelativeDailyLimit {
    function _minPerTx() internal view returns (uint256) {
        return executionMinPerTx();
    }

    function executionDailyLimit() public view returns (uint256) {
        return _getTodayLimit();
    }

    function setExecutionMinPerTx(uint256 _minPerTx) external onlyOwner {
        require(_minPerTx < executionMaxPerTx());
        uintStorage[EXECUTION_MIN_PER_TX] = _minPerTx;
    }

    function setExecutionMaxPerTx(uint256 _maxPerTx) external onlyOwner {
        require(_maxPerTx > executionMinPerTx());
        uintStorage[EXECUTION_MAX_PER_TX] = _maxPerTx;
    }
}
