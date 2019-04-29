pragma solidity 0.4.24;


import "./BasicBridge.sol";
import "openzeppelin-solidity/contracts/token/ERC20/ERC20Basic.sol";

contract ERC20ExtendedBridge is BasicBridge {
    function onTokenTransfer(address _from, uint256 _value, bytes /*_data*/) external returns(bool) {
        require(msg.sender == address(erc20token()));
        require(withinLimit(_value));
        setTotalSpentPerDay(getCurrentDay(), totalSpentPerDay(getCurrentDay()).add(_value));
        fireEventOnTokenTransfer(_from, _value);
        return true;
    }

    function erc20token() public view returns(ERC20Basic);

    function fireEventOnTokenTransfer(address /*_from */, uint256 /* _value */) internal;
}
