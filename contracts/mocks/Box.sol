pragma solidity 0.4.24;

import "../interfaces/IAMB.sol";

contract Box {
    uint256 public value;
    address public lastSender;

    function setValue(uint256 _value) public {
        value = _value;
        lastSender = IAMB(msg.sender).messageSender();
    }

    function methodWillFail() public {
        revert();
    }

    function methodOutOfGas() public {
        uint256 a = 0;
        for (uint256 i = 0; i < 1000; i++) {
            a = a + i;
        }
    }

    function methodWillFailOnOtherNetwork(address _bridge, address _executor) public {
        bytes4 methodSelector = this.methodWillFail.selector;
        bytes memory encodedData = abi.encodeWithSelector(methodSelector);
        IAMB(_bridge).requireToPassMessage(_executor, encodedData, 141647);
    }

    function methodOutOfGasOnOtherNetwork(address _bridge, address _executor) public {
        bytes4 methodSelector = this.methodOutOfGas.selector;
        bytes memory encodedData = abi.encodeWithSelector(methodSelector);
        IAMB(_bridge).requireToPassMessage(_executor, encodedData, 1000);
    }

    function setValueOnOtherNetwork(uint256 _i, address _bridge, address _executor) public {
        bytes4 methodSelector = this.setValue.selector;
        bytes memory encodedData = abi.encodeWithSelector(methodSelector, _i);
        IAMB(_bridge).requireToPassMessage(_executor, encodedData, 141647);
    }

    function setValueOnOtherNetworkGasPrice(uint256 _i, address _bridge, address _executor, uint256 _gasPrice) public {
        bytes4 methodSelector = this.setValue.selector;
        bytes memory encodedData = abi.encodeWithSelector(methodSelector, _i);
        IAMB(_bridge).requireToPassMessage(_executor, encodedData, 821254, _gasPrice);
    }

    function setValueOnOtherNetworkGasPriceOracle(
        uint256 _i,
        address _bridge,
        address _executor,
        bytes1 _oracleGasPriceSpeed
    ) public {
        bytes4 methodSelector = this.setValue.selector;
        bytes memory encodedData = abi.encodeWithSelector(methodSelector, _i);
        IAMB(_bridge).requireToPassMessage(_executor, encodedData, 821254, _oracleGasPriceSpeed);
    }

    function withdrawFromDepositOnOtherNetworkGasPrice(
        address _recipient,
        address _bridge,
        address _executor,
        uint256 _gasPrice
    ) public {
        bytes4 methodSelector = IAMB(0).withdrawFromDeposit.selector;
        bytes memory encodedData = abi.encodeWithSelector(methodSelector, _recipient);
        IAMB(_bridge).requireToPassMessage(_executor, encodedData, 821254, _gasPrice);
    }
}
