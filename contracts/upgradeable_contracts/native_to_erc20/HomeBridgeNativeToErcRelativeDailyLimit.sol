pragma solidity 0.4.24;

import "./HomeBridgeNativeToErc.sol";
import "../RelativeExecutionDailyLimit.sol";

contract HomeBridgeNativeToErcRelativeDailyLimit is HomeBridgeNativeToErc, RelativeExecutionDailyLimit {
    function executeAffirmation(address recipient, uint256 value, bytes32 transactionHash) public onlyValidator {
        _updateTodayLimit();
        super.executeAffirmation(recipient, value, transactionHash);
    }

    function initialize(
        address _validatorContract,
        uint256[] _requestLimitsArray, // [ 0 = _dailyLimit, 1 = _maxPerTx, 2 = _minPerTx ]
        uint256 _homeGasPrice,
        uint256 _requiredBlockConfirmations,
        uint256[] _executionLimitsArray, // [ 0 = _targetLimit, 1 = _tthreshold, 2 = _foreignMaxPerTx, 3 = _foreignMinPerTx ]
        address _owner,
        uint256 _decimalShift
    ) external returns (bool) {
        _setLimits(_requestLimitsArray, _executionLimitsArray);
        _initialize(_validatorContract, _homeGasPrice, _requiredBlockConfirmations, _owner, _decimalShift);
        setInitialize();
        return isInitialized();
    }

    function rewardableInitialize(
        address _validatorContract,
        uint256[] _requestLimitsArray, // [ 0 = _dailyLimit, 1 = _maxPerTx, 2 = _minPerTx ]
        uint256 _homeGasPrice,
        uint256 _requiredBlockConfirmations,
        uint256[] _executionLimitsArray, // [ 0 = _targetLimit, 1 = _tthreshold, 2 = _foreignMaxPerTx, 3 = _foreignMinPerTx ]
        address _owner,
        address _feeManager,
        uint256[] _homeFeeForeignFeeArray, // [ 0 = _homeFee, 1 = _foreignFee ]
        uint256 _decimalShift
    ) external returns (bool) {
        _setLimits(_requestLimitsArray, _executionLimitsArray);
        _initialize(_validatorContract, _homeGasPrice, _requiredBlockConfirmations, _owner, _decimalShift);
        require(AddressUtils.isContract(_feeManager));
        addressStorage[FEE_MANAGER_CONTRACT] = _feeManager;
        _setFee(_feeManager, _homeFeeForeignFeeArray[0], HOME_FEE);
        _setFee(_feeManager, _homeFeeForeignFeeArray[1], FOREIGN_FEE);
        setInitialize();
        return isInitialized();
    }

    function _setLimits(
        uint256[] _requestLimitsArray, // [ 0 = _dailyLimit, 1 = _maxPerTx, 2 = _minPerTx ]
        uint256[] _executionLimitsArray // [ 0 = _targetLimit, 1 = _threshold, 2 = _foreignMaxPerTx, 3 = _foreignMinPerTx ]
    ) internal {
        require(
            _requestLimitsArray[2] > 0 && // _minPerTx > 0
                _requestLimitsArray[1] > _requestLimitsArray[2] && // _maxPerTx > _minPerTx
                _requestLimitsArray[0] > _requestLimitsArray[1] // _dailyLimit > _maxPerTx
        );
        require(
            _executionLimitsArray[3] > 0 && // _foreignMinPerTx > 0
                _executionLimitsArray[2] > _executionLimitsArray[3] && // _foreignMaxPerTx > _foreignMinPerTx
                _executionLimitsArray[1] >= _executionLimitsArray[3] && // _threshold >= _foreignMinPerTx
                _executionLimitsArray[0] <= 1 ether // _targetLimit <= 1 ether
        );

        uintStorage[DAILY_LIMIT] = _requestLimitsArray[0];
        uintStorage[MAX_PER_TX] = _requestLimitsArray[1];
        uintStorage[MIN_PER_TX] = _requestLimitsArray[2];
        uintStorage[TARGET_LIMIT] = _executionLimitsArray[0];
        uintStorage[THRESHOLD] = _executionLimitsArray[1];
        uintStorage[EXECUTION_MAX_PER_TX] = _executionLimitsArray[2];
        uintStorage[EXECUTION_MIN_PER_TX] = _executionLimitsArray[3];

        emit DailyLimitChanged(_requestLimitsArray[0]);
    }

    function _getTokenBalance() internal view returns (uint256) {
        return address(this).balance;
    }
}
