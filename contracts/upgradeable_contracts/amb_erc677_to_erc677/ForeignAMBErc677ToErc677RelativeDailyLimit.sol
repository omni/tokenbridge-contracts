pragma solidity 0.4.24;

import "./ForeignAMBErc677ToErc677.sol";
import "../RelativeExecutionDailyLimit.sol";

contract ForeignAMBErc677ToErc677RelativeDailyLimit is ForeignAMBErc677ToErc677, RelativeExecutionDailyLimit {
    function initialize(
        address _bridgeContract,
        address _mediatorContract,
        address _erc677token,
        uint256[] _dailyLimitMaxPerTxMinPerTxArray, // [ 0 = _dailyLimit, 1 = _maxPerTx, 2 = _minPerTx ]
        uint256[] _targetLimitThresholdExecutionMaxPerTxExecutionMinPerTxArray, // [ 0 = _targetLimit, 1 = _threshold, 2 = _executionMaxPerTx, 3 = _executionMinPerTx ]
        uint256 _requestGasLimit,
        uint256 _decimalShift,
        address _owner
    ) external returns (bool) {
        require(
            _dailyLimitMaxPerTxMinPerTxArray[2] > 0 && // _minPerTx > 0
                _dailyLimitMaxPerTxMinPerTxArray[1] > _dailyLimitMaxPerTxMinPerTxArray[2] && // _maxPerTx > _minPerTx
                _dailyLimitMaxPerTxMinPerTxArray[0] > _dailyLimitMaxPerTxMinPerTxArray[1] // _dailyLimit > _maxPerTx
        );
        require(
            _targetLimitThresholdExecutionMaxPerTxExecutionMinPerTxArray[3] > 0 && // _executionMinPerTx > 0
            _targetLimitThresholdExecutionMaxPerTxExecutionMinPerTxArray[2] > _targetLimitThresholdExecutionMaxPerTxExecutionMinPerTxArray[3] // _executionMaxPerTx > _executionMinPerTx
        );
        require(_targetLimitThresholdExecutionMaxPerTxExecutionMinPerTxArray[0] <= 1 ether); // _targetLimit <= 1 ether
        require(_targetLimitThresholdExecutionMaxPerTxExecutionMinPerTxArray[1] >= _targetLimitThresholdExecutionMaxPerTxExecutionMinPerTxArray[3]); // _threshold >= _executionMinPerTx

        uintStorage[DAILY_LIMIT] = _dailyLimitMaxPerTxMinPerTxArray[0];
        uintStorage[MAX_PER_TX] = _dailyLimitMaxPerTxMinPerTxArray[1];
        uintStorage[MIN_PER_TX] = _dailyLimitMaxPerTxMinPerTxArray[2];
        uintStorage[TARGET_LIMIT] = _targetLimitThresholdExecutionMaxPerTxExecutionMinPerTxArray[0];
        uintStorage[THRESHOLD] = _targetLimitThresholdExecutionMaxPerTxExecutionMinPerTxArray[1];
        uintStorage[EXECUTION_MAX_PER_TX] = _targetLimitThresholdExecutionMaxPerTxExecutionMinPerTxArray[2];
        uintStorage[EXECUTION_MIN_PER_TX] = _targetLimitThresholdExecutionMaxPerTxExecutionMinPerTxArray[3];

        emit DailyLimitChanged(_dailyLimitMaxPerTxMinPerTxArray[0]);

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
        return erc677token().balanceOf(address(this));
    }
}
