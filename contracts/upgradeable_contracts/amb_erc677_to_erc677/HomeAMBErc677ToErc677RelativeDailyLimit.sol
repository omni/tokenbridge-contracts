pragma solidity 0.4.24;

import "./HomeAMBErc677ToErc677.sol";
import "../RelativeDailyLimit.sol";

contract HomeAMBErc677ToErc677RelativeDailyLimit is HomeAMBErc677ToErc677, RelativeDailyLimit {
    function initialize(
        address _bridgeContract,
        address _mediatorContract,
        address _erc677token,
        uint256[] _targetLimitThresholdMaxPerTxMinPerTxArray, // [ 0 = _targetLimit, 1 = threshold, 2 = _maxPerTx, 3 = _minPerTx ]
        uint256[] _executionDailyLimitExecutionMaxPerTxExecutionMinPerTxArray, // [ 0 = _executionDailyLimit, 1 = _executionMaxPerTx, 2 = _executionMinPerTx ]
        uint256 _requestGasLimit,
        uint256 _decimalShift,
        address _owner
    ) external returns (bool) {
        require(
            _targetLimitThresholdMaxPerTxMinPerTxArray[3] > 0 && // _minPerTx > 0
                _targetLimitThresholdMaxPerTxMinPerTxArray[2] > _targetLimitThresholdMaxPerTxMinPerTxArray[3] // _maxPerTx > _minPerTx
        );
        require(
            _executionDailyLimitExecutionMaxPerTxExecutionMinPerTxArray[2] > 0 && // _executionMinPerTx > 0
            _executionDailyLimitExecutionMaxPerTxExecutionMinPerTxArray[1] > _executionDailyLimitExecutionMaxPerTxExecutionMinPerTxArray[2] && // _executionMaxPerTx > _executionMinPerTx
            _executionDailyLimitExecutionMaxPerTxExecutionMinPerTxArray[1] < _executionDailyLimitExecutionMaxPerTxExecutionMinPerTxArray[0] // _executionMaxPerTx < _executionDailyLimit
        );
        require(_targetLimitThresholdMaxPerTxMinPerTxArray[0] <= 1 ether); // _targetLimit <= 1 ether
        require(_targetLimitThresholdMaxPerTxMinPerTxArray[1] >= _targetLimitThresholdMaxPerTxMinPerTxArray[3]); // _threshold >= _executionMinPerTx

        uintStorage[TARGET_LIMIT] = _targetLimitThresholdMaxPerTxMinPerTxArray[0];
        uintStorage[THRESHOLD] = _targetLimitThresholdMaxPerTxMinPerTxArray[1];
        uintStorage[MAX_PER_TX] = _targetLimitThresholdMaxPerTxMinPerTxArray[2];
        uintStorage[MIN_PER_TX] = _targetLimitThresholdMaxPerTxMinPerTxArray[3];
        uintStorage[EXECUTION_DAILY_LIMIT] = _executionDailyLimitExecutionMaxPerTxExecutionMinPerTxArray[0];
        uintStorage[EXECUTION_MAX_PER_TX] = _executionDailyLimitExecutionMaxPerTxExecutionMinPerTxArray[1];
        uintStorage[EXECUTION_MIN_PER_TX] = _executionDailyLimitExecutionMaxPerTxExecutionMinPerTxArray[2];

        emit ExecutionDailyLimitChanged(_executionDailyLimitExecutionMaxPerTxExecutionMinPerTxArray[0]);

        return _initialize(
            _bridgeContract,
            _mediatorContract,
            _erc677token,
            _requestGasLimit,
            _decimalShift,
            _owner
        );
    }

    function _getTokenBalance() internal view returns (uint256) {
        return erc677token().totalSupply();
    }
}
