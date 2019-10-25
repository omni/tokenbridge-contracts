pragma solidity 0.4.24;

import "./ForeignBridgeErc677ToErc677.sol";
import "./BasicForeignBridgeErcToErcRelativeDailyLimit.sol";

// solhint-disable-next-line no-empty-blocks
contract ForeignBridgeErc677ToErc677RelativeDailyLimit is
    BasicForeignBridgeErcToErcRelativeDailyLimit,
    ForeignBridgeErc677ToErc677
{
    function initialize(
        address _validatorContract,
        address _erc20token,
        uint256 _requiredBlockConfirmations,
        uint256 _gasPrice,
        uint256[] _dailyLimitMaxPerTxMinPerTxArray, // [ 0 = _dailyLimit, 1 = _maxPerTx, 2 = _minPerTx ]
        uint256[] _targetLimitThresholdHomeMaxPerTxHomeMinPerTxArray, // [ 0 = _targetLimit, 1 = _threshold, 2 = _homeMaxPerTx, 3 = _homeMinPerTx]
        address _owner,
        uint256 _decimalShift
    ) external returns (bool) {
        require(
            _dailyLimitMaxPerTxMinPerTxArray[2] > 0 && // _minPerTx > 0
                _dailyLimitMaxPerTxMinPerTxArray[1] > _dailyLimitMaxPerTxMinPerTxArray[2] && // _maxPerTx > _minPerTx
                _dailyLimitMaxPerTxMinPerTxArray[0] > _dailyLimitMaxPerTxMinPerTxArray[1] // _dailyLimit > _maxPerTx
        );
        require(
            _targetLimitThresholdHomeMaxPerTxHomeMinPerTxArray[3] > 0 && // _homeMinPerTx > 0
            _targetLimitThresholdHomeMaxPerTxHomeMinPerTxArray[2] > _targetLimitThresholdHomeMaxPerTxHomeMinPerTxArray[3] && // _homeMaxPerTx > _homeMinPerTx
            _targetLimitThresholdHomeMaxPerTxHomeMinPerTxArray[2] < _targetLimitThresholdHomeMaxPerTxHomeMinPerTxArray[1] // _homeMaxPerTx < _homeDailyLimit
        );
        require(_targetLimitThresholdHomeMaxPerTxHomeMinPerTxArray[0] <= 1 ether); // _targetLimit <= 1 ether
        require(_targetLimitThresholdHomeMaxPerTxHomeMinPerTxArray[1] >= _targetLimitThresholdHomeMaxPerTxHomeMinPerTxArray[3]); // _threshold >= _homeMinPerTx

        uintStorage[DAILY_LIMIT] = _dailyLimitMaxPerTxMinPerTxArray[0];
        uintStorage[MAX_PER_TX] = _dailyLimitMaxPerTxMinPerTxArray[1];
        uintStorage[MIN_PER_TX] = _dailyLimitMaxPerTxMinPerTxArray[2];
        uintStorage[TARGET_LIMIT] = _targetLimitThresholdHomeMaxPerTxHomeMinPerTxArray[0];
        uintStorage[THRESHOLD] = _targetLimitThresholdHomeMaxPerTxHomeMinPerTxArray[1];
        uintStorage[EXECUTION_MAX_PER_TX] = _targetLimitThresholdHomeMaxPerTxHomeMinPerTxArray[2];
        uintStorage[EXECUTION_MIN_PER_TX] = _targetLimitThresholdHomeMaxPerTxHomeMinPerTxArray[3];

        _initialize(
            _validatorContract,
            _erc20token,
            _requiredBlockConfirmations,
            _gasPrice,
            _owner,
            _decimalShift
        );

        emit DailyLimitChanged(_dailyLimitMaxPerTxMinPerTxArray[0]);

        return isInitialized();
    }
}
