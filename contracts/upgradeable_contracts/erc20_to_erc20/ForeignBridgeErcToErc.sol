pragma solidity 0.4.24;

import "./BasicForeignBridgeErcToErc.sol";
import "../ERC20Bridge.sol";

contract ForeignBridgeErcToErc is BasicForeignBridgeErcToErc, ERC20Bridge {
    function initialize(
        address _validatorContract,
        address _erc20token,
        uint256 _requiredBlockConfirmations,
        uint256 _gasPrice,
        uint256[] _requestLimitsArray, // [ 0 = _dailyLimit, 1 = _maxPerTx, 2 = _minPerTx ]
        uint256[] _executionLimitsArray, // [ 0 = _homeDailyLimit, 1 = _homeMaxPerTx, 2 = _homeMinPerTx ]
        address _owner,
        uint256 _decimalShift
    ) external returns (bool) {
        require(
            _executionLimitsArray[2] > 0 && // _homeMinPerTx > 0
                _executionLimitsArray[1] > _executionLimitsArray[2] && // _homeMaxPerTx > _homeMinPerTx
                _executionLimitsArray[1] < _executionLimitsArray[0] // _homeMaxPerTx < _homeDailyLimit
        );

        uintStorage[EXECUTION_DAILY_LIMIT] = _executionLimitsArray[0];
        uintStorage[EXECUTION_MAX_PER_TX] = _executionLimitsArray[1];
        uintStorage[EXECUTION_MIN_PER_TX] = _executionLimitsArray[2];

        _initialize(
            _validatorContract,
            _erc20token,
            _requiredBlockConfirmations,
            _gasPrice,
            _requestLimitsArray,
            _owner,
            _decimalShift
        );

        emit ExecutionDailyLimitChanged(_executionLimitsArray[0]);

        return isInitialized();
    }
}
