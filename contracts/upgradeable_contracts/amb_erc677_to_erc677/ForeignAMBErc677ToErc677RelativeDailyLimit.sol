pragma solidity 0.4.24;

import "./ForeignAMBErc677ToErc677.sol";
import "../RelativeExecutionDailyLimit.sol";

contract ForeignAMBErc677ToErc677RelativeDailyLimit is ForeignAMBErc677ToErc677, RelativeExecutionDailyLimit {
    function initialize(
        address _bridgeContract,
        address _mediatorContract,
        address _erc677token,
        uint256[] _requestLimitsArray, // [ 0 = _dailyLimit, 1 = _maxPerTx, 2 = _minPerTx ]
        uint256[] _executionLimitsArray, // [ 0 = _targetLimit, 1 = _threshold, 2 = _executionMaxPerTx, 3 = _executionMinPerTx ]
        uint256 _requestGasLimit,
        uint256 _decimalShift,
        address _owner
    ) external returns (bool) {
        require(
            _requestLimitsArray[2] > 0 && // _minPerTx > 0
                _requestLimitsArray[1] > _requestLimitsArray[2] && // _maxPerTx > _minPerTx
                _requestLimitsArray[0] > _requestLimitsArray[1] // _dailyLimit > _maxPerTx
        );
        require(
            _executionLimitsArray[3] > 0 && // _executionMinPerTx > 0
            _executionLimitsArray[2] > _executionLimitsArray[3] // _executionMaxPerTx > _executionMinPerTx
        );
        require(_executionLimitsArray[0] <= 1 ether); // _targetLimit <= 1 ether
        require(_executionLimitsArray[1] >= _executionLimitsArray[3]); // _threshold >= _executionMinPerTx

        uintStorage[DAILY_LIMIT] = _requestLimitsArray[0];
        uintStorage[MAX_PER_TX] = _requestLimitsArray[1];
        uintStorage[MIN_PER_TX] = _requestLimitsArray[2];
        uintStorage[TARGET_LIMIT] = _executionLimitsArray[0];
        uintStorage[THRESHOLD] = _executionLimitsArray[1];
        uintStorage[EXECUTION_MAX_PER_TX] = _executionLimitsArray[2];
        uintStorage[EXECUTION_MIN_PER_TX] = _executionLimitsArray[3];

        emit DailyLimitChanged(_requestLimitsArray[0]);

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
