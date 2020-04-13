pragma solidity 0.4.24;

contract AMBMock {
    event MockedEvent(bytes32 indexed messageId, bytes encodedData);

    address public messageSender;
    uint256 public maxGasPerTx;
    bytes32 public messageId;
    bytes32 public nonce;
    mapping(bytes32 => bool) public messageCallStatus;
    mapping(bytes32 => address) public failedMessageSender;
    mapping(bytes32 => address) public failedMessageReceiver;

    function setMaxGasPerTx(uint256 _value) public {
        maxGasPerTx = _value;
    }

    function executeMessageCall(address _contract, address _sender, bytes _data, bytes32 _messageId, uint256 _gas)
        public
    {
        messageSender = _sender;
        messageId = _messageId;
        bool status = _contract.call.gas(_gas)(_data);
        messageSender = address(0);
        messageId = bytes32(0);

        messageCallStatus[_messageId] = status;
        if (!status) {
            failedMessageReceiver[_messageId] = _contract;
            failedMessageSender[_messageId] = _sender;
        }
    }

    function requireToPassMessage(address _contract, bytes _data, uint256 _gas) external returns (bytes32) {
        nonce = keccak256(abi.encodePacked(nonce));
        emit MockedEvent(nonce, abi.encodePacked(msg.sender, _contract, _gas, uint8(0x00), _data));
        return nonce;
    }
}
