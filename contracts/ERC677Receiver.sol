pragma solidity 0.4.23;


contract ERC677Receiver {
  function onTokenTransfer(address _from, uint _value, bytes _data) external returns(bool);
}
