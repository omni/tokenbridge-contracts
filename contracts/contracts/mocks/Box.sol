pragma solidity 0.4.24;

import "../interfaces/IAMB.sol";

contract Box {
    uint256 public value;
    address public lastSender;
    bytes32 public messageId;
    bytes32 public txHash;
    uint256 public messageSourceChainId;

    function setValue(uint256 _value) public {
        value = _value;
        lastSender = IAMB(msg.sender).messageSender();
        messageId = IAMB(msg.sender).messageId();
        txHash = IAMB(msg.sender).transactionHash();
        messageSourceChainId = uint256(IAMB(msg.sender).messageSourceChainId());
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

    function setValueOnOtherNetwork(
        uint256 _i,
        address _bridge,
        address _executor
    ) public {
        bytes4 methodSelector = this.setValue.selector;
        bytes memory encodedData = abi.encodeWithSelector(methodSelector, _i);
        IAMB(_bridge).requireToPassMessage(_executor, encodedData, 141647);
    }
}
