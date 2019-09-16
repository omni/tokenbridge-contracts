pragma solidity 0.4.24;

contract AMBMock {
    event MockedEvent(bytes encodedData);

    address public messageSender;
    uint256 public maxGasPerTx;
    bytes32 public transactionHash;
    mapping(bytes32 => bool) public messageCallStatus;
    mapping(bytes32 => address) public failedMessageSender;
    mapping(bytes32 => address) public failedMessageReceiver;
    mapping(bytes32 => bytes32) public failedMessageDataHash;

    function setMaxGasPerTx(uint256 _value) public {
        maxGasPerTx = _value;
    }

    function executeMessageCall(address _contract, address _sender, bytes _data, bytes32 _txHash, uint256 _gas) public {
        messageSender = _sender;
        transactionHash = _txHash;
        bool status = _contract.call.gas(_gas)(_data);
        messageSender = address(0);
        transactionHash = bytes32(0);

        messageCallStatus[_txHash] = status;
        if (!status) {
            failedMessageDataHash[_txHash] = keccak256(_data);
            failedMessageReceiver[_txHash] = _contract;
            failedMessageSender[_txHash] = _sender;
        }
    }

    function requireToPassMessage(address _contract, bytes _data, uint256 _gas) public {
        emit MockedEvent(abi.encodePacked(msg.sender, _contract, _gas, uint8(0x00), _data));
    }
}
