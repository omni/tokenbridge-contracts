pragma solidity 0.4.24;

import "./ForeignBridgeNativeToErc.sol";
import "../RelativeDailyLimit.sol";

contract ForeignBridgeNativeToErcRelativeDailyLimit is ForeignBridgeNativeToErc, RelativeDailyLimit {
    function initialize(
        address _validatorContract,
        address _erc677token,
        uint256[] _targetLimitThresholdMaxPerTxMinPerTxArray, // [ 0 = _targetLimit, 1 = threshold, 2 = _maxPerTx, 3 = _minPerTx ]
        uint256 _foreignGasPrice,
        uint256 _requiredBlockConfirmations,
        uint256[] _homeDailyLimitHomeMaxPerTxHomeMinPerTxArray, // [ 0 = _homeDailyLimit, 1 = _homeMaxPerTx, 2 = _homeMinPerTx ]
        address _owner,
        uint256 _decimalShift
    ) external returns (bool) {
        _setLimits(
            _targetLimitThresholdMaxPerTxMinPerTxArray,
            _homeDailyLimitHomeMaxPerTxHomeMinPerTxArray
        );
        _initialize(
            _validatorContract,
            _erc677token,
            _foreignGasPrice,
            _requiredBlockConfirmations,
            _owner,
            _decimalShift
        );
        setInitialize();
        return isInitialized();
    }

    function rewardableInitialize(
        address _validatorContract,
        address _erc677token,
        uint256[] _targetLimitThresholdMaxPerTxMinPerTxArray, // [ 0 = _targetLimit, 1 = threshold, 2 = _maxPerTx, 3 = _minPerTx ]
        uint256 _foreignGasPrice,
        uint256 _requiredBlockConfirmations,
        uint256[] _homeDailyLimitHomeMaxPerTxHomeMinPerTxArray, // [ 0 = _homeDailyLimit, 1 = _homeMaxPerTx, 2 = _homeMinPerTx ]
        address _owner,
        address _feeManager,
        uint256 _homeFee,
        uint256 _decimalShift
    ) external returns (bool) {
        _setLimits(
            _targetLimitThresholdMaxPerTxMinPerTxArray,
            _homeDailyLimitHomeMaxPerTxHomeMinPerTxArray
        );
        _initialize(
            _validatorContract,
            _erc677token,
            _foreignGasPrice,
            _requiredBlockConfirmations,
            _owner,
            _decimalShift
        );
        require(AddressUtils.isContract(_feeManager));
        addressStorage[FEE_MANAGER_CONTRACT] = _feeManager;
        _setFee(_feeManager, _homeFee, HOME_FEE);
        setInitialize();
        return isInitialized();
    }

    function _setLimits(
        uint256[] _targetLimitThresholdMaxPerTxMinPerTxArray, // [ 0 = _targetLimit, 1 = threshold, 2 = _maxPerTx, 3 = _minPerTx ]
        uint256[] _homeDailyLimitHomeMaxPerTxHomeMinPerTxArray // [ 0 = _homeDailyLimit, 1 = _homeMaxPerTx, 2 = _homeMinPerTx ]
    ) internal {
        require(
            _targetLimitThresholdMaxPerTxMinPerTxArray[3] > 0 && // _minPerTx > 0
                _targetLimitThresholdMaxPerTxMinPerTxArray[2] > _targetLimitThresholdMaxPerTxMinPerTxArray[3] // _maxPerTx > _minPerTx
        );
        require(
            _homeDailyLimitHomeMaxPerTxHomeMinPerTxArray[2] > 0 && // _homeMinPerTx > 0
            _homeDailyLimitHomeMaxPerTxHomeMinPerTxArray[1] > _homeDailyLimitHomeMaxPerTxHomeMinPerTxArray[2] && // _homeMaxPerTx > _homeMinPerTx
            _homeDailyLimitHomeMaxPerTxHomeMinPerTxArray[1] < _homeDailyLimitHomeMaxPerTxHomeMinPerTxArray[0] // _homeMaxPerTx < _homeDailyLimit
        );

        uintStorage[TARGET_LIMIT] = _targetLimitThresholdMaxPerTxMinPerTxArray[0];
        uintStorage[THRESHOLD] = _targetLimitThresholdMaxPerTxMinPerTxArray[1];
        uintStorage[MAX_PER_TX] = _targetLimitThresholdMaxPerTxMinPerTxArray[2];
        uintStorage[MIN_PER_TX] = _targetLimitThresholdMaxPerTxMinPerTxArray[3];
        uintStorage[EXECUTION_DAILY_LIMIT] = _homeDailyLimitHomeMaxPerTxHomeMinPerTxArray[0];
        uintStorage[EXECUTION_MAX_PER_TX] = _homeDailyLimitHomeMaxPerTxHomeMinPerTxArray[1];
        uintStorage[EXECUTION_MIN_PER_TX] = _homeDailyLimitHomeMaxPerTxHomeMinPerTxArray[2];

        emit ExecutionDailyLimitChanged(_homeDailyLimitHomeMaxPerTxHomeMinPerTxArray[0]);
    }

    function _getTokenBalance() internal view returns (uint256) {
        return erc677token().totalSupply();
    }
}
