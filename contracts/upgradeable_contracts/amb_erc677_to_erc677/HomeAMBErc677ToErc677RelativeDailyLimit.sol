pragma solidity 0.4.24;

import "./HomeAMBErc677ToErc677.sol";
import "../RelativeDailyLimit.sol";

contract HomeAMBErc677ToErc677RelativeDailyLimit is HomeAMBErc677ToErc677, RelativeDailyLimit {
    function relayTokens(uint256 _value) public {
        _updateTodayLimit();
        super.relayTokens(_value);
    }

    function onTokenTransfer(
        address _from,
        uint256 _value,
        bytes _data
    ) public returns (bool) {
        _updateTodayLimit();
        return super.onTokenTransfer(_from, _value, _data);
    }

    function initialize(
        address _bridgeContract,
        address _mediatorContract,
        address _erc677token,
        uint256[] _requestLimitsArray, // [ 0 = _targetLimit, 1 = threshold, 2 = _maxPerTx, 3 = _minPerTx ]
        uint256[] _executionLimitsArray, // [ 0 = _executionDailyLimit, 1 = _executionMaxPerTx, 2 = _executionMinPerTx ]
        uint256 _requestGasLimit,
        uint256 _decimalShift,
        address _owner
    ) external returns (bool) {
        require(
            _requestLimitsArray[3] > 0 && // _minPerTx > 0
                _requestLimitsArray[2] > _requestLimitsArray[3] && // _maxPerTx > _minPerTx
                _requestLimitsArray[1] >= _requestLimitsArray[3] && // _threshold >= _minPerTx
                _requestLimitsArray[0] <= 1 ether // _targetLimit <= 1 ether
        );
        require(
            _executionLimitsArray[2] > 0 && // _executionMinPerTx > 0
                _executionLimitsArray[1] > _executionLimitsArray[2] && // _executionMaxPerTx > _executionMinPerTx
                _executionLimitsArray[1] < _executionLimitsArray[0] // _executionMaxPerTx < _executionDailyLimit
        );

        uintStorage[TARGET_LIMIT] = _requestLimitsArray[0];
        uintStorage[THRESHOLD] = _requestLimitsArray[1];
        uintStorage[MAX_PER_TX] = _requestLimitsArray[2];
        uintStorage[MIN_PER_TX] = _requestLimitsArray[3];
        uintStorage[EXECUTION_DAILY_LIMIT] = _executionLimitsArray[0];
        uintStorage[EXECUTION_MAX_PER_TX] = _executionLimitsArray[1];
        uintStorage[EXECUTION_MIN_PER_TX] = _executionLimitsArray[2];

        emit ExecutionDailyLimitChanged(_executionLimitsArray[0]);

        return _initialize(_bridgeContract, _mediatorContract, _erc677token, _requestGasLimit, _decimalShift, _owner);
    }

    function _getTokenBalance() internal view returns (uint256) {
        return erc677token().totalSupply();
    }
}
