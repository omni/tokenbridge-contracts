pragma solidity 0.4.24;


import "./BasicBridge.sol";
import "../ERC677.sol";
import "../IBurnableMintableERC677Token.sol";

contract ERC677Bridge is BasicBridge {
    function erc677token() public view returns(IBurnableMintableERC677Token) {
        return IBurnableMintableERC677Token(addressStorage[keccak256(abi.encodePacked("erc677token"))]);
    }

    function setErc677token(address _token) internal {
        require(_token != address(0) && isContract(_token));
        addressStorage[keccak256(abi.encodePacked("erc677token"))] = _token;
    }

    function onTokenTransfer(address _from, uint256 _value, bytes /*_data*/) external returns(bool) {
        IBurnableMintableERC677Token token = erc677token();
        require(msg.sender == address(token));
        require(withinLimit(_value));
        setTotalSpentPerDay(getCurrentDay(), totalSpentPerDay(getCurrentDay()).add(_value));
        bridgeSpecificActionsOnTokenTransfer(token, _from, _value);
        return true;
    }

    function bridgeSpecificActionsOnTokenTransfer(IBurnableMintableERC677Token _token, address _from, uint256 _value) internal {
        fireEventOnTokenTransfer(_from, _value);
    }

    function fireEventOnTokenTransfer(address _from, uint256 _value) internal;
}
