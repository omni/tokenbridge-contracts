pragma solidity 0.4.24;

import "./HomeBridgeErcToErc.sol";
import "../RelativeDailyLimit.sol";

contract HomeBridgeErcToErcRelativeDailyLimit is HomeBridgeErcToErc, RelativeDailyLimit {
    function initialize(
        address _validatorContract,
        uint256[] _targetLimitThresholdMaxPerTxMinPerTxArray, // [ 0 = _targetLimit, 1 = _threshold, 2 = _maxPerTx, 3 = _minPerTx ]
        uint256 _homeGasPrice,
        uint256 _requiredBlockConfirmations,
        address _erc677token,
        uint256[] _foreignDailyLimitForeignMaxPerTxForeignMinPerTxArray, // [ 0 = _foreignDailyLimit, 1 = _foreignMaxPerTx, 2 = _foreignMinPerTx ]
        address _owner,
        uint256 _decimalShift
    ) external returns (bool) {
        _setLimits(
            _targetLimitThresholdMaxPerTxMinPerTxArray,
            _foreignDailyLimitForeignMaxPerTxForeignMinPerTxArray
        );
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
        uint256[] _targetLimitThresholdMaxPerTxMinPerTxArray, // [ 0 = _targetLimit, 1 = _threshold, 2 = _maxPerTx, 3 = _minPerTx ]
        uint256 _homeGasPrice,
        uint256 _requiredBlockConfirmations,
        address _erc677token,
        uint256[] _foreignDailyLimitForeignMaxPerTxForeignMinPerTxArray, // [ 0 = _foreignDailyLimit, 1 = _foreignMaxPerTx, 2 = _foreignMinPerTx ]
        address _owner,
        address _feeManager,
        uint256[] _homeFeeForeignFeeArray, // [ 0 = _homeFee, 1 = _foreignFee ]
        uint256 _decimalShift
    ) external returns (bool) {
        _setLimits(
            _targetLimitThresholdMaxPerTxMinPerTxArray,
            _foreignDailyLimitForeignMaxPerTxForeignMinPerTxArray
        );
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
        uint256[] _targetLimitThresholdMaxPerTxMinPerTxArray, // [ 0 = _targetLimit, 1 = _threshold, 2 = _maxPerTx, 3 = _minPerTx ]
        uint256[] _foreignDailyLimitForeignMaxPerTxForeignMinPerTxArray // [ 0 = _foreignDailyLimit, 1 = _foreignMaxPerTx, 2 = _foreignMinPerTx ]
    ) internal {
        require(
            _targetLimitThresholdMaxPerTxMinPerTxArray[3] > 0 && // _minPerTx > 0
                _targetLimitThresholdMaxPerTxMinPerTxArray[2] > _targetLimitThresholdMaxPerTxMinPerTxArray[3] // _maxPerTx > _minPerTx
        );
        require(
            _foreignDailyLimitForeignMaxPerTxForeignMinPerTxArray[2] > 0 && // _foreignMinPerTx > 0
            _foreignDailyLimitForeignMaxPerTxForeignMinPerTxArray[1] > _foreignDailyLimitForeignMaxPerTxForeignMinPerTxArray[2] && // _foreignMaxPerTx > _foreignMinPerTx
            _foreignDailyLimitForeignMaxPerTxForeignMinPerTxArray[1] < _foreignDailyLimitForeignMaxPerTxForeignMinPerTxArray[0] // _foreignMaxPerTx < _foreignDailyLimit
        );

        uintStorage[TARGET_LIMIT] = _targetLimitThresholdMaxPerTxMinPerTxArray[0];
        uintStorage[THRESHOLD] = _targetLimitThresholdMaxPerTxMinPerTxArray[1];
        uintStorage[MAX_PER_TX] = _targetLimitThresholdMaxPerTxMinPerTxArray[2];
        uintStorage[MIN_PER_TX] = _targetLimitThresholdMaxPerTxMinPerTxArray[3];
        uintStorage[EXECUTION_DAILY_LIMIT] = _foreignDailyLimitForeignMaxPerTxForeignMinPerTxArray[0];
        uintStorage[EXECUTION_MAX_PER_TX] = _foreignDailyLimitForeignMaxPerTxForeignMinPerTxArray[1];
        uintStorage[EXECUTION_MIN_PER_TX] = _foreignDailyLimitForeignMaxPerTxForeignMinPerTxArray[2];

        emit ExecutionDailyLimitChanged(_foreignDailyLimitForeignMaxPerTxForeignMinPerTxArray[0]);
    }

    function _getTokenBalance() internal view returns (uint256) {
        return erc677token().totalSupply();
    }
}
