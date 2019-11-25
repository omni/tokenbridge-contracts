pragma solidity 0.4.24;

import "./HomeBridgeErcToErc.sol";
import "../RelativeDailyLimit.sol";

contract HomeBridgeErcToErcRelativeDailyLimit is HomeBridgeErcToErc, RelativeDailyLimit {
    function onTokenTransfer(address _from, uint256 _value, bytes _data) public returns (bool) {
        _updateTodayLimit();
        return super.onTokenTransfer(_from, _value, _data);
    }

    function initialize(
        address _validatorContract,
        uint256[] _requestLimitsArray, // [ 0 = _targetLimit, 1 = _threshold, 2 = _maxPerTx, 3 = _minPerTx ]
        uint256 _homeGasPrice,
        uint256 _requiredBlockConfirmations,
        address _erc677token,
        uint256[] _executionLimitsArray, // [ 0 = _foreignDailyLimit, 1 = _foreignMaxPerTx, 2 = _foreignMinPerTx ]
        address _owner,
        uint256 _decimalShift
    ) external returns (bool) {
        _setLimits(_requestLimitsArray, _executionLimitsArray);
        _initialize(
            _validatorContract,
            _homeGasPrice,
            _requiredBlockConfirmations,
            _erc677token,
            _owner,
            _decimalShift
        );
        setInitialize();

        return isInitialized();
    }

    function rewardableInitialize(
        address _validatorContract,
        uint256[] _requestLimitsArray, // [ 0 = _targetLimit, 1 = _threshold, 2 = _maxPerTx, 3 = _minPerTx ]
        uint256 _homeGasPrice,
        uint256 _requiredBlockConfirmations,
        address _erc677token,
        uint256[] _executionLimitsArray, // [ 0 = _foreignDailyLimit, 1 = _foreignMaxPerTx, 2 = _foreignMinPerTx ]
        address _owner,
        address _feeManager,
        uint256[] _homeFeeForeignFeeArray, // [ 0 = _homeFee, 1 = _foreignFee ]
        uint256 _decimalShift
    ) external returns (bool) {
        _setLimits(_requestLimitsArray, _executionLimitsArray);
        _rewardableInitialize(
            _validatorContract,
            _homeGasPrice,
            _requiredBlockConfirmations,
            _erc677token,
            _owner,
            _feeManager,
            _homeFeeForeignFeeArray,
            _decimalShift
        );
        setInitialize();

        return isInitialized();
    }

    function _setLimits(
        uint256[] _requestLimitsArray, // [ 0 = _targetLimit, 1 = _threshold, 2 = _maxPerTx, 3 = _minPerTx ]
        uint256[] _executionLimitsArray // [ 0 = _foreignDailyLimit, 1 = _foreignMaxPerTx, 2 = _foreignMinPerTx ]
    ) internal {
        require(
            _requestLimitsArray[3] > 0 && // _minPerTx > 0
                _requestLimitsArray[2] > _requestLimitsArray[3] && // _maxPerTx > _minPerTx
                _requestLimitsArray[1] >= _requestLimitsArray[3] && // _threshold >= _minPerTx
                _requestLimitsArray[0] <= 1 ether // _targetLimit <= 1 ether
        );
        require(
            _executionLimitsArray[2] > 0 && // _foreignMinPerTx > 0
                _executionLimitsArray[1] > _executionLimitsArray[2] && // _foreignMaxPerTx > _foreignMinPerTx
                _executionLimitsArray[1] < _executionLimitsArray[0] // _foreignMaxPerTx < _foreignDailyLimit
        );

        uintStorage[TARGET_LIMIT] = _requestLimitsArray[0];
        uintStorage[THRESHOLD] = _requestLimitsArray[1];
        uintStorage[MAX_PER_TX] = _requestLimitsArray[2];
        uintStorage[MIN_PER_TX] = _requestLimitsArray[3];
        uintStorage[EXECUTION_DAILY_LIMIT] = _executionLimitsArray[0];
        uintStorage[EXECUTION_MAX_PER_TX] = _executionLimitsArray[1];
        uintStorage[EXECUTION_MIN_PER_TX] = _executionLimitsArray[2];

        emit ExecutionDailyLimitChanged(_executionLimitsArray[0]);
    }

    function _getTokenBalance() internal view returns (uint256) {
        return erc677token().totalSupply();
    }
}
