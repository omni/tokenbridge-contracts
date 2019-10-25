pragma solidity 0.4.24;

import "./HomeBridgeNativeToErc.sol";
import "../RelativeExecutionDailyLimit.sol";

contract HomeBridgeNativeToErcRelativeDailyLimit is HomeBridgeNativeToErc, RelativeExecutionDailyLimit {
    function initialize(
        address _validatorContract,
        uint256[] _dailyLimitMaxPerTxMinPerTxArray, // [ 0 = _dailyLimit, 1 = _maxPerTx, 2 = _minPerTx ]
        uint256 _homeGasPrice,
        uint256 _requiredBlockConfirmations,
        uint256[] _targetLimitThresholdForeignMaxPerTxForeignMinPerTxArray, // [ 0 = _targetLimit, 1 = _tthreshold, 2 = _foreignMaxPerTx, 3 = _foreignMinPerTx ]
        address _owner,
        uint256 _decimalShift
    ) external returns (bool) {
        _setLimits(
            _dailyLimitMaxPerTxMinPerTxArray,
            _targetLimitThresholdForeignMaxPerTxForeignMinPerTxArray
        );
        _initialize(
            _validatorContract,
            _homeGasPrice,
            _requiredBlockConfirmations,
            _owner,
            _decimalShift
        );
        setInitialize();
        return isInitialized();
    }

    function rewardableInitialize(
        address _validatorContract,
        uint256[] _dailyLimitMaxPerTxMinPerTxArray, // [ 0 = _dailyLimit, 1 = _maxPerTx, 2 = _minPerTx ]
        uint256 _homeGasPrice,
        uint256 _requiredBlockConfirmations,
        uint256[] _targetLimitThresholdForeignMaxPerTxForeignMinPerTxArray, // [ 0 = _targetLimit, 1 = _tthreshold, 2 = _foreignMaxPerTx, 3 = _foreignMinPerTx ]
        address _owner,
        address _feeManager,
        uint256[] _homeFeeForeignFeeArray, // [ 0 = _homeFee, 1 = _foreignFee ]
        uint256 _decimalShift
    ) external returns (bool) {
        _setLimits(
            _dailyLimitMaxPerTxMinPerTxArray,
            _targetLimitThresholdForeignMaxPerTxForeignMinPerTxArray
        );
        _initialize(
            _validatorContract,
            _homeGasPrice,
            _requiredBlockConfirmations,
            _owner,
            _decimalShift
        );
        require(AddressUtils.isContract(_feeManager));
        addressStorage[FEE_MANAGER_CONTRACT] = _feeManager;
        _setFee(_feeManager, _homeFeeForeignFeeArray[0], HOME_FEE);
        _setFee(_feeManager, _homeFeeForeignFeeArray[1], FOREIGN_FEE);
        setInitialize();
        return isInitialized();
    }

    function _setLimits(
        uint256[] _dailyLimitMaxPerTxMinPerTxArray, // [ 0 = _dailyLimit, 1 = _maxPerTx, 2 = _minPerTx ]
        uint256[] _targetLimitThresholdForeignMaxPerTxForeignMinPerTxArray // [ 0 = _targetLimit, 1 = _tthreshold, 2 = _foreignMaxPerTx, 3 = _foreignMinPerTx ]
    ) internal {
        require(
            _dailyLimitMaxPerTxMinPerTxArray[2] > 0 && // _minPerTx > 0
                _dailyLimitMaxPerTxMinPerTxArray[1] > _dailyLimitMaxPerTxMinPerTxArray[2] && // _maxPerTx > _minPerTx
                _dailyLimitMaxPerTxMinPerTxArray[0] > _dailyLimitMaxPerTxMinPerTxArray[1] // _dailyLimit > _maxPerTx
        );
        require(
            _targetLimitThresholdForeignMaxPerTxForeignMinPerTxArray[3] > 0 && // _foreignMinPerTx > 0
            _targetLimitThresholdForeignMaxPerTxForeignMinPerTxArray[2] > _targetLimitThresholdForeignMaxPerTxForeignMinPerTxArray[3] // _foreignMaxPerTx > _foreignMinPerTx
        );

        uintStorage[DAILY_LIMIT] = _dailyLimitMaxPerTxMinPerTxArray[0];
        uintStorage[MAX_PER_TX] = _dailyLimitMaxPerTxMinPerTxArray[1];
        uintStorage[MIN_PER_TX] = _dailyLimitMaxPerTxMinPerTxArray[2];
        uintStorage[TARGET_LIMIT] = _targetLimitThresholdForeignMaxPerTxForeignMinPerTxArray[0];
        uintStorage[THRESHOLD] = _targetLimitThresholdForeignMaxPerTxForeignMinPerTxArray[1];
        uintStorage[EXECUTION_MAX_PER_TX] = _targetLimitThresholdForeignMaxPerTxForeignMinPerTxArray[2];
        uintStorage[EXECUTION_MIN_PER_TX] = _targetLimitThresholdForeignMaxPerTxForeignMinPerTxArray[3];

        emit DailyLimitChanged(_dailyLimitMaxPerTxMinPerTxArray[0]);
    }

    function _getTokenBalance() internal view returns (uint256) {
        return address(this).balance;
    }
}
