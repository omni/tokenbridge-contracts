pragma solidity 0.4.24;

import "./BasicForeignBridgeErcToErc.sol";
import "../ERC20Bridge.sol";

contract ForeignBridgeErcToErc is BasicForeignBridgeErcToErc, ERC20Bridge {
    function initialize(
        address _validatorContract,
        address _erc20token,
        uint256 _requiredBlockConfirmations,
        uint256 _gasPrice,
        uint256[] _maxPerTxHomeDailyLimitHomeMaxPerTxArray, // [ 0 = _maxPerTx, 1 = _homeDailyLimit, 2 = _homeMaxPerTx ]
        address _owner,
        uint256 _decimalShift
    ) external returns (bool) {
        _initialize(
            _validatorContract,
            _erc20token,
            _requiredBlockConfirmations,
            _gasPrice,
            _maxPerTxHomeDailyLimitHomeMaxPerTxArray,
            _owner,
            _decimalShift
        );
        return isInitialized();
    }
}
