pragma solidity 0.4.24;

import "./BasicForeignBridgeErcToErc.sol";
import "../ERC20Bridge.sol";

contract ForeignBridgeErcToErc is BasicForeignBridgeErcToErc, ERC20Bridge {
    function initialize(
        address _validatorContract,
        address _erc20token,
        uint256 _requiredBlockConfirmations,
        uint256 _gasPrice,
        uint256[] _maxPerTxHomeDailyLimitHomeMaxPerTxHomeMinPerTxArray, // [ 0 = _maxPerTx, 1 = _homeDailyLimit, 2 = _homeMaxPerTx, 3 = _homeMinPerTx ]
        address _owner,
        uint256 _decimalShift
    ) external returns (bool) {
        require(
            _maxPerTxHomeDailyLimitHomeMaxPerTxHomeMinPerTxArray[3] > 0 && // _homeMinPerTx > 0
            _maxPerTxHomeDailyLimitHomeMaxPerTxHomeMinPerTxArray[2] > _maxPerTxHomeDailyLimitHomeMaxPerTxHomeMinPerTxArray[3] && // _homeMaxPerTx > _homeMinPerTx
            _maxPerTxHomeDailyLimitHomeMaxPerTxHomeMinPerTxArray[2] < _maxPerTxHomeDailyLimitHomeMaxPerTxHomeMinPerTxArray[1] // _homeMaxPerTx < _homeDailyLimit
        );

        uintStorage[MAX_PER_TX] = _maxPerTxHomeDailyLimitHomeMaxPerTxHomeMinPerTxArray[0];
        uintStorage[EXECUTION_DAILY_LIMIT] = _maxPerTxHomeDailyLimitHomeMaxPerTxHomeMinPerTxArray[1];
        uintStorage[EXECUTION_MAX_PER_TX] = _maxPerTxHomeDailyLimitHomeMaxPerTxHomeMinPerTxArray[2];
        uintStorage[EXECUTION_MIN_PER_TX] = _maxPerTxHomeDailyLimitHomeMaxPerTxHomeMinPerTxArray[3];

        _initialize(
            _validatorContract,
            _erc20token,
            _requiredBlockConfirmations,
            _gasPrice,
            _owner,
            _decimalShift
        );

        emit ExecutionDailyLimitChanged(_maxPerTxHomeDailyLimitHomeMaxPerTxHomeMinPerTxArray[1]);

        return isInitialized();
    }
}
