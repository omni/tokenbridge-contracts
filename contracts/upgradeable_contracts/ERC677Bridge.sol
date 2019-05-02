pragma solidity 0.4.24;


import "./BasicBridge.sol";
import "../ERC677.sol";

contract ERC677Bridge is BasicBridge {
    function erc677token() public view returns(ERC677) {
        return ERC677(addressStorage[keccak256(abi.encodePacked("erc677token"))]);
    }

    function setErc677token(address _token) internal {
        require(_token != address(0) && isContract(_token));
        addressStorage[keccak256(abi.encodePacked("erc677token"))] = _token;
    }

    function onTokenTransfer(address _from, uint256 _value, bytes /*_data*/) external returns(bool) {
        ERC677 token = erc677token();
        require(msg.sender == address(token));
        require(withinLimit(_value));
        setTotalSpentPerDay(getCurrentDay(), totalSpentPerDay(getCurrentDay()).add(_value));
        bridgeSpecificActionsOnTokenTransfer(token, _from, _value);
        return true;
    }

    function bridgeSpecificActionsOnTokenTransfer(ERC677 _token, address _from, uint256 _value) internal {
        fireEventOnTokenTransfer(_from, _value);
    }

    function fireEventOnTokenTransfer(address _from, uint256 _value) internal;
}
