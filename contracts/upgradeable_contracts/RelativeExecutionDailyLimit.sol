pragma solidity 0.4.24;

import "./BasicRelativeDailyLimit.sol";

contract RelativeExecutionDailyLimit is BasicRelativeDailyLimit {
    function _setExecutionLimits(
        uint256[] _executionLimitsArray // [ 0 = _targetLimit, 1 = _threshold, 2 = _executionMaxPerTx, 3 = _executionMinPerTx ]
    ) internal {
        require(
            _executionLimitsArray[3] > 0 && // _executionMinPerTx > 0
                _executionLimitsArray[2] > _executionLimitsArray[3] && // _executionMaxPerTx > _executionMinPerTx
                _executionLimitsArray[1] >= _executionLimitsArray[3] && // _threshold >= _executionMinPerTx
                _executionLimitsArray[0] <= 1 ether // _targetLimit <= 1 ether
        );
        uintStorage[TARGET_LIMIT] = _executionLimitsArray[0];
        uintStorage[THRESHOLD] = _executionLimitsArray[1];
        uintStorage[EXECUTION_MAX_PER_TX] = _executionLimitsArray[2];
        uintStorage[EXECUTION_MIN_PER_TX] = _executionLimitsArray[3];
    }

    function _minPerTx() internal view returns (uint256) {
        return executionMinPerTx();
    }

    function executionDailyLimit(uint256 _tokenBalance) public view returns (uint256) {
        return _getTodayLimit(_tokenBalance);
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
