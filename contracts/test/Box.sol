pragma solidity 0.4.24;

import "../upgradeable_contracts/arbitrary_message/MessageDelivery.sol";

contract Box {
  event dataEvent(bytes selectorData);
  uint256 public value;

  function setValue(uint256 _value) public {
    value = _value;
  }

  function methodWillFail() public {
    revert();
  }

  function methodOutOfGas() public {
    uint256 a = 0;
    for (uint i = 0; i < 1000; i++) {
      a = a + i;
    }
  }

  function methodWillFailOnOtherNetwork(address _bridge, address _executor) public {
    bytes4 methodSelector = this.methodWillFail.selector;
    bytes memory encodedData = abi.encodeWithSelector(methodSelector);
    MessageDelivery bridge = MessageDelivery(_bridge);
    bridge.requireToPassMessage(_executor, encodedData, 141647);
  }

  function methodOutOfGasOnOtherNetwork(address _bridge, address _executor) public {
    bytes4 methodSelector = this.methodOutOfGas.selector;
    bytes memory encodedData = abi.encodeWithSelector(methodSelector);
    MessageDelivery bridge = MessageDelivery(_bridge);
    bridge.requireToPassMessage(_executor, encodedData, 1000);
  }

  function setValueOnOtherNetwork(uint256 _i, address _bridge, address _executor) public {
    bytes4 methodSelector = this.setValue.selector;
    bytes memory encodedData = abi.encodeWithSelector(methodSelector, _i);
    MessageDelivery bridge = MessageDelivery(_bridge);
    bridge.requireToPassMessage(_executor, encodedData, 141647);
  }

  function setValueOnOtherNetworkGasPrice(uint256 _i, address _bridge, address _executor, uint256 _gasPrice) public {
    bytes4 methodSelector = this.setValue.selector;
    bytes memory encodedData = abi.encodeWithSelector(methodSelector, _i);
    MessageDelivery bridge = MessageDelivery(_bridge);
    bridge.requireToPassMessage(_executor, encodedData, 821254, _gasPrice);
  }

  function setValueOnOtherNetworkGasPriceOracle(uint256 _i, address _bridge, address _executor, bytes1 _oracleGasPriceSpeed) public {
    bytes4 methodSelector = this.setValue.selector;
    bytes memory encodedData = abi.encodeWithSelector(methodSelector, _i);
    MessageDelivery bridge = MessageDelivery(_bridge);
    bridge.requireToPassMessage(_executor, encodedData, 821254, _oracleGasPriceSpeed);
  }

  function withdrawFromDeposit(address _recipient) public {
  }

}
