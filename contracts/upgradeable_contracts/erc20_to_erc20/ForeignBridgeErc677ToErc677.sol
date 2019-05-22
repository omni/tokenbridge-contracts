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
        uint256 _dailyLimit,
        uint256 _maxPerTx,
        uint256 _minPerTx,
        uint256 _homeDailyLimit,
        uint256 _homeMaxPerTx,
        address _owner
    ) public returns(bool) {
        require(_minPerTx > 0 && _maxPerTx > _minPerTx && _dailyLimit > _maxPerTx);

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

        uintStorage[keccak256(abi.encodePacked("dailyLimit"))] = _dailyLimit;
        uintStorage[keccak256(abi.encodePacked("minPerTx"))] = _minPerTx;

        return isInitialized();
    }

    function erc20token() public view returns(ERC20Basic) {
        return erc677token();
    }

    function setErc20token(address _token) internal {
        setErc677token(_token);
    }

    function fireEventOnTokenTransfer(address _from, uint256 _value) internal {
        emit UserRequestForAffirmation(_from, _value);
    }
}
