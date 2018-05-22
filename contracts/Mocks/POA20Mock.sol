pragma solidity 0.4.21;

import "../POA20.sol";

contract POA20Mock is POA20{
    function POA20Mock(
        string _name,
        string _symbol,
        uint8 _decimals)
    public POA20(_name, _symbol, _decimals) {}

    function () payable {}
}