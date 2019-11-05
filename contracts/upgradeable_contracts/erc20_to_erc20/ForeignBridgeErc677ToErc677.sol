pragma solidity 0.4.24;

import "./BasicForeignBridgeErcToErc.sol";
import "../ERC677Bridge.sol";

contract ForeignBridgeErc677ToErc677 is ERC677Bridge, BasicForeignBridgeErcToErc {
    function initialize(
        address _validatorContract,
        address _erc20token,
        uint256 _requiredBlockConfirmations,
        uint256 _gasPrice,
        uint256[] _requestLimitsArray, // [ 0 = _dailyLimit, 1 = _maxPerTx, 2 = _minPerTx ]
        uint256[] _executionLimitsArray, // [ 0 = _homeDailyLimit, 1 = _homeMaxPerTx, 2 = _homeMinPerTx]
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

    function erc20token() public view returns (ERC20) {
        return erc677token();
    }

    function setErc20token(address _token) internal {
        setErc677token(_token);
    }

    function fireEventOnTokenTransfer(address _from, uint256 _value) internal {
        emit UserRequestForAffirmation(_from, _value);
    }
}
