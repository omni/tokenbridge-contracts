pragma solidity 0.4.24;

import "./BasicForeignBridgeErcToErc.sol";
import "../ERC20Bridge.sol";

contract ForeignBridgeErcToErc is BasicForeignBridgeErcToErc, ERC20Bridge {
    event UserRequestForAffirmation(address recipient, uint256 value);

    function initialize(
        address _validatorContract,
        address _erc20token,
        uint256 _requiredBlockConfirmations,
        uint256 _gasPrice,
        uint256[] _dailyLimitMaxPerTxMinPerTxArray, // [ 0 = _dailyLimit, 1 = _maxPerTx, 2 = _minPerTx ]
        uint256[] _homeDailyLimitHomeMaxPerTxArray, // [ 0 = _homeDailyLimit, 1 = _homeMaxPerTx ]
        address _owner,
        uint256 _decimalShift
    ) external returns (bool) {
        _initialize(
            _validatorContract,
            _erc20token,
            _requiredBlockConfirmations,
            _gasPrice,
            _dailyLimitMaxPerTxMinPerTxArray,
            _homeDailyLimitHomeMaxPerTxArray,
            _owner,
            _decimalShift
        );
        return isInitialized();
    }

    function _relayRequest(address _sender, address _receiver, uint256 _amount) internal {
        require(_receiver != address(0));
        require(_receiver != address(this));
        require(_amount > 0);
        require(withinLimit(_amount));
        setTotalSpentPerDay(getCurrentDay(), totalSpentPerDay(getCurrentDay()).add(_amount));

        erc20token().transferFrom(_sender, address(this), _amount);
        emit UserRequestForAffirmation(_receiver, _amount);
    }

    function relayRequest(address _from, address _receiver, uint256 _amount) external {
        require(_from == msg.sender || _from == _receiver);
        _relayRequest(_from, _receiver, _amount);
    }

    function relayRequest(address _receiver, uint256 _amount) external {
        _relayRequest(msg.sender, _receiver, _amount);
    }
}
