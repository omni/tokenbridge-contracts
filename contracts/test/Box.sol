pragma solidity 0.4.24;

contract Box {
  event dataEvent(bytes selectorData);
  uint256 public value;

  function setValue(uint256 _value) public {
    value = _value;
  }

  function getSetValueData(uint256 _value) public {
    bytes4 methodSelector = this.setValue.selector;
    bytes memory encodedData = abi.encodeWithSelector(methodSelector, _value);
    emit dataEvent(encodedData);
  }

}
