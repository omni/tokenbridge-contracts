pragma solidity 0.4.24;

import "./BasicForeignBridgeErcToErc.sol";
import "../ERC677Bridge.sol";

contract ForeignBridgeErc677ToErc677 is ERC677Bridge, BasicForeignBridgeErcToErc {
    event UserRequestForAffirmation(address recipient, uint256 value);

    function initialize(
        address _validatorContract,
        address _erc20token,
        uint256 _requiredBlockConfirmations,
        uint256 _gasPrice,
        uint256[] _dailyLimitMaxPerTxMinPerTxArray, // [ 0 = _dailyLimit, 1 = _maxPerTx, 2 = _minPerTx ]
        uint256[] _homeDailyLimitHomeMaxPerTxHomeMinPerTxArray, // [ 0 = _homeDailyLimit, 1 = _homeMaxPerTx, 2 = _homeMinPerTx]
        address _owner,
        uint256 _decimalShift
    ) external returns (bool) {
        require(
            _dailyLimitMaxPerTxMinPerTxArray[2] > 0 && // _minPerTx > 0
                _dailyLimitMaxPerTxMinPerTxArray[1] > _dailyLimitMaxPerTxMinPerTxArray[2] && // _maxPerTx > _minPerTx
                _dailyLimitMaxPerTxMinPerTxArray[0] > _dailyLimitMaxPerTxMinPerTxArray[1] // _dailyLimit > _maxPerTx
        );
        require(
            _homeDailyLimitHomeMaxPerTxHomeMinPerTxArray[2] > 0 && // _homeMinPerTx > 0
            _homeDailyLimitHomeMaxPerTxHomeMinPerTxArray[1] > _homeDailyLimitHomeMaxPerTxHomeMinPerTxArray[2] && // _homeMaxPerTx > _homeMinPerTx
            _homeDailyLimitHomeMaxPerTxHomeMinPerTxArray[1] < _homeDailyLimitHomeMaxPerTxHomeMinPerTxArray[0] // _homeMaxPerTx < _homeDailyLimit
        );

        uintStorage[DAILY_LIMIT] = _dailyLimitMaxPerTxMinPerTxArray[0];
        uintStorage[MAX_PER_TX] = _dailyLimitMaxPerTxMinPerTxArray[1];
        uintStorage[MIN_PER_TX] = _dailyLimitMaxPerTxMinPerTxArray[2];
        uintStorage[EXECUTION_DAILY_LIMIT] = _homeDailyLimitHomeMaxPerTxHomeMinPerTxArray[0];
        uintStorage[EXECUTION_MAX_PER_TX] = _homeDailyLimitHomeMaxPerTxHomeMinPerTxArray[1];
        uintStorage[EXECUTION_MIN_PER_TX] = _homeDailyLimitHomeMaxPerTxHomeMinPerTxArray[2];

        _initialize(
            _validatorContract,
            _erc20token,
            _requiredBlockConfirmations,
            _gasPrice,
            _owner,
            _decimalShift
        );

        emit DailyLimitChanged(_dailyLimitMaxPerTxMinPerTxArray[0]);
        emit ExecutionDailyLimitChanged(_homeDailyLimitHomeMaxPerTxHomeMinPerTxArray[0]);

        return isInitialized();
    }

    function erc20token() public view returns (ERC20Basic) {
        return erc677token();
    }

    function setErc20token(address _token) internal {
        setErc677token(_token);
    }

    function fireEventOnTokenTransfer(address _from, uint256 _value) internal {
        emit UserRequestForAffirmation(_from, _value);
    }
}
