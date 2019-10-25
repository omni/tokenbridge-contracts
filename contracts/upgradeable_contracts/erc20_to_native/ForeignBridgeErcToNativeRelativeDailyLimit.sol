pragma solidity 0.4.24;

import "./ForeignBridgeErcToNative.sol";
import "../RelativeExecutionDailyLimit.sol";

contract ForeignBridgeErcToNativeRelativeDailyLimit is ForeignBridgeErcToNative, RelativeExecutionDailyLimit {
    function initialize(
        address _validatorContract,
        address _erc20token,
        uint256 _requiredBlockConfirmations,
        uint256 _gasPrice,
        uint256[] _maxPerTxTargetLimitThresholdHomeMaxPerTxHomeMinPerTxArray, //[ 0 = _maxPerTx, 1 = _targetLimit, 2 = _threshold, 3 = _homeMaxPerTx, 4 = _homeMinPerTx ]
        address _owner,
        uint256 _decimalShift
    ) external returns (bool) {
        require(
            _maxPerTxTargetLimitThresholdHomeMaxPerTxHomeMinPerTxArray[4] > 0 && // _homeMinPerTx > 0
            _maxPerTxTargetLimitThresholdHomeMaxPerTxHomeMinPerTxArray[3] > _maxPerTxTargetLimitThresholdHomeMaxPerTxHomeMinPerTxArray[2] // _homeMaxPerTx > _homeMinPerTx
        );

        uintStorage[MAX_PER_TX] = _maxPerTxTargetLimitThresholdHomeMaxPerTxHomeMinPerTxArray[0];
        uintStorage[TARGET_LIMIT] = _maxPerTxTargetLimitThresholdHomeMaxPerTxHomeMinPerTxArray[1];
        uintStorage[THRESHOLD] = _maxPerTxTargetLimitThresholdHomeMaxPerTxHomeMinPerTxArray[2];
        uintStorage[EXECUTION_MAX_PER_TX] = _maxPerTxTargetLimitThresholdHomeMaxPerTxHomeMinPerTxArray[3];
        uintStorage[EXECUTION_MIN_PER_TX] = _maxPerTxTargetLimitThresholdHomeMaxPerTxHomeMinPerTxArray[4];

        return _initialize(
            _validatorContract,
            _erc20token,
            _requiredBlockConfirmations,
            _gasPrice,
            _owner,
            _decimalShift
        );
    }

    function _getTokenBalance() internal view returns (uint256) {
        return erc20token().balanceOf(address(this));
    }
}
