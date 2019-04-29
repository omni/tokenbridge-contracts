pragma solidity 0.4.24;


import "./ForeignBridgeErcToErc.sol";
import "../ERC20ExtendedBridge.sol";


contract ForeignBridgeExtendedErcToErc is ERC20ExtendedBridge, ForeignBridgeErcToErc {

    event UserRequestForAffirmation(address recipient, uint256 value);

    function extendedInitialize(
        address _validatorContract,
        address _erc20token,
        uint256 _requiredBlockConfirmations,
        uint256 _gasPrice,
        uint256 _dailyLimit,
        uint256 _maxPerTx,
        uint256 _minPerTx,
        uint256 _homeDailyLimit,
        uint256 _homeMaxPerTx,
        address _owner
    ) public returns(bool) {
        require(_minPerTx > 0 && _maxPerTx > _minPerTx && _dailyLimit > _maxPerTx);
        uintStorage[keccak256(abi.encodePacked("dailyLimit"))] = _dailyLimit;
        uintStorage[keccak256(abi.encodePacked("minPerTx"))] = _minPerTx;

        _initialize(
            _validatorContract,
            _erc20token,
            _requiredBlockConfirmations,
            _gasPrice,
            _maxPerTx,
            _homeDailyLimit,
            _homeMaxPerTx,
            _owner
        );
        return isInitialized();
    }

    function initialize(
        address /* _validatorContract */,
        address /* _erc20token */,
        uint256 /* _requiredBlockConfirmations */,
        uint256 /* _gasPrice */,
        uint256 /* _maxPerTx */,
        uint256 /* _homeDailyLimit */,
        uint256 /* _homeMaxPerTx */,
        address /* _owner */
    ) public returns(bool) {
        revert();
    }

    function fireEventOnTokenTransfer(address _from, uint256 _value) internal {
        emit UserRequestForAffirmation(_from, _value);
    }
}
