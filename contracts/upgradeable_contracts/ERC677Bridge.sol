pragma solidity 0.4.24;


import "./BasicBridge.sol";
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
        require(msg.sender == address(erc677token()));
        require(withinLimit(_value));
        setTotalSpentPerDay(getCurrentDay(), totalSpentPerDay(getCurrentDay()).add(_value));
        erc677token().burn(_value);
        fireEventOnTokenTransfer(_from, _value);
        return true;
    }

    function fireEventOnTokenTransfer(address /*_from */, uint256 /* _value */) internal {
        // has to be defined
    }

}
