pragma solidity 0.4.24;

contract Box {
  uint256 public value;

  function setValue(uint256 _value) public {
    value = _value;
  }
}
