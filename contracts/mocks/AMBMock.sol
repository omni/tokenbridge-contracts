pragma solidity 0.4.24;

import "../libraries/Bytes.sol";

contract AMBMock {
    event MockedEvent(bytes32 indexed messageId, bytes encodedData);

    address public messageSender;
    uint256 public maxGasPerTx;
    bytes32 public transactionHash;
    bytes32 public messageId;
    uint64 public nonce;
    mapping(bytes32 => bool) public messageCallStatus;
    mapping(bytes32 => address) public failedMessageSender;
    mapping(bytes32 => address) public failedMessageReceiver;
    mapping(bytes32 => bytes32) public failedMessageDataHash;

    function setMaxGasPerTx(uint256 _value) public {
        maxGasPerTx = _value;
    }

    function executeMessageCall(address _contract, address _sender, bytes _data, bytes32 _messageId, uint256 _gas)
        public
    {
        messageSender = _sender;
        messageId = _messageId;
        transactionHash = _messageId;
        bool status = _contract.call.gas(_gas)(_data);
        messageSender = address(0);
        messageId = bytes32(0);
        transactionHash = bytes32(0);

        messageCallStatus[_messageId] = status;
        if (!status) {
            failedMessageDataHash[_messageId] = keccak256(_data);
            failedMessageReceiver[_messageId] = _contract;
            failedMessageSender[_messageId] = _sender;
        }
    }

    function requireToPassMessage(address _contract, bytes _data, uint256 _gas) external returns (bytes32) {
        uint256 chainId = 1337;
        bytes20 bridgeId = bytes20(keccak256(abi.encodePacked(chainId, address(this))));

        bytes32 messageId = Bytes.bytesToBytes32(abi.encodePacked(bytes4(0x11223344), bridgeId, nonce));
        nonce += 1;
        bytes memory eventData = abi.encodePacked(
            messageId,
            chainId,
            msg.sender,
            _contract,
            uint32(_gas),
            uint8(0x00),
            _data
        );

        emit MockedEvent(messageId, eventData);
        return messageId;
    }
}
