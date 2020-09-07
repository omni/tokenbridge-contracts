pragma solidity 0.4.24;

import "../libraries/Bytes.sol";

contract AMBMock {
    event MockedEvent(bytes32 indexed messageId, bytes encodedData);

    address public messageSender;
    uint256 public maxGasPerTx;
    bytes32 public transactionHash;
    bytes32 public messageId;
    uint64 public nonce;
    uint256 public messageSourceChainId;
    mapping(bytes32 => bool) public messageCallStatus;
    mapping(bytes32 => address) public failedMessageSender;
    mapping(bytes32 => address) public failedMessageReceiver;
    mapping(bytes32 => bytes32) public failedMessageDataHash;

    function setMaxGasPerTx(uint256 _value) public {
        maxGasPerTx = _value;
    }

    function executeMessageCall(
        address _contract,
        address _sender,
        bytes _data,
        bytes32 _messageId,
        uint256 _gas
    ) public {
        messageSender = _sender;
        messageId = _messageId;
        transactionHash = _messageId;
        messageSourceChainId = 1337;
        bool status = _contract.call.gas(_gas)(_data);
        messageSender = address(0);
        messageId = bytes32(0);
        transactionHash = bytes32(0);
        messageSourceChainId = 0;

        messageCallStatus[_messageId] = status;
        if (!status) {
            failedMessageDataHash[_messageId] = keccak256(_data);
            failedMessageReceiver[_messageId] = _contract;
            failedMessageSender[_messageId] = _sender;
        }
    }

    function requireToPassMessage(
        address _contract,
        bytes _data,
        uint256 _gas
    ) external returns (bytes32) {
        require(messageId == bytes32(0));
        bytes32 bridgeId = keccak256(abi.encodePacked(uint16(1337), address(this))) &
            0x00000000ffffffffffffffffffffffffffffffffffffffff0000000000000000;

        bytes32 _messageId = bytes32(0x11223344 << 224) | bridgeId | bytes32(nonce);
        nonce += 1;
        bytes memory eventData = abi.encodePacked(
            _messageId,
            msg.sender,
            _contract,
            uint32(_gas),
            uint8(2),
            uint8(2),
            uint8(0x00),
            uint16(1337),
            uint16(1338),
            _data
        );

        emit MockedEvent(_messageId, eventData);
        return _messageId;
    }

    function sourceChainId() external pure returns (uint256) {
        return 1337;
    }
}
