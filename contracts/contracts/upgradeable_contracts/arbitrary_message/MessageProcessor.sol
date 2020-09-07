pragma solidity 0.4.24;

import "../../upgradeability/EternalStorage.sol";
import "../../libraries/Bytes.sol";

contract MessageProcessor is EternalStorage {
    bytes32 internal constant MESSAGE_SENDER = 0x7b58b2a669d8e0992eae9eaef641092c0f686fd31070e7236865557fa1571b5b; // keccak256(abi.encodePacked("messageSender"))
    bytes32 internal constant MESSAGE_ID = 0xe34bb2103dc34f2c144cc216c132d6ffb55dac57575c22e089161bbe65083304; // keccak256(abi.encodePacked("messageId"))
    bytes32
        internal constant MESSAGE_SOURCE_CHAIN_ID = 0x7f0fcd9e49860f055dd0c1682d635d309ecb5e3011654c716d9eb59a7ddec7d2; // keccak256(abi.encodePacked("messageSourceChainId"))

    /**
     * @dev Returns a status of the message that came from the other side.
     * @param _messageId id of the message from the other side that triggered a call.
     * @return true if call executed successfully.
     */
    function messageCallStatus(bytes32 _messageId) external view returns (bool) {
        return boolStorage[keccak256(abi.encodePacked("messageCallStatus", _messageId))];
    }

    /**
     * @dev Sets a status of the message that came from the other side.
     * @param _messageId id of the message from the other side that triggered a call.
     * @param _status execution status, true if executed successfully.
     */
    function setMessageCallStatus(bytes32 _messageId, bool _status) internal {
        boolStorage[keccak256(abi.encodePacked("messageCallStatus", _messageId))] = _status;
    }

    /**
     * @dev Returns a data hash of the failed message that came from the other side.
     * NOTE: dataHash was used previously to identify outgoing message before AMB message id was introduced.
     * It is kept for backwards compatibility with old mediators contracts.
     * @param _messageId id of the message from the other side that triggered a call.
     * @return keccak256 hash of message data.
     */
    function failedMessageDataHash(bytes32 _messageId) external view returns (bytes32) {
        return bytes32(uintStorage[keccak256(abi.encodePacked("failedMessageDataHash", _messageId))]);
    }

    /**
     * @dev Sets a data hash of the failed message that came from the other side.
     * NOTE: dataHash was used previously to identify outgoing message before AMB message id was introduced.
     * It is kept for backwards compatibility with old mediators contracts.
     * @param _messageId id of the message from the other side that triggered a call.
     * @param data of the processed message.
     */
    function setFailedMessageDataHash(bytes32 _messageId, bytes data) internal {
        uintStorage[keccak256(abi.encodePacked("failedMessageDataHash", _messageId))] = uint256(keccak256(data));
    }

    /**
     * @dev Returns a receiver address of the failed message that came from the other side.
     * @param _messageId id of the message from the other side that triggered a call.
     * @return receiver address.
     */
    function failedMessageReceiver(bytes32 _messageId) external view returns (address) {
        return addressStorage[keccak256(abi.encodePacked("failedMessageReceiver", _messageId))];
    }

    /**
     * @dev Sets a sender address of the failed message that came from the other side.
     * @param _messageId id of the message from the other side that triggered a call.
     * @param _receiver address of the receiver.
     */
    function setFailedMessageReceiver(bytes32 _messageId, address _receiver) internal {
        addressStorage[keccak256(abi.encodePacked("failedMessageReceiver", _messageId))] = _receiver;
    }

    /**
     * @dev Returns a sender address of the failed message that came from the other side.
     * @param _messageId id of the message from the other side that triggered a call.
     * @return sender address on the other side.
     */
    function failedMessageSender(bytes32 _messageId) external view returns (address) {
        return addressStorage[keccak256(abi.encodePacked("failedMessageSender", _messageId))];
    }

    /**
     * @dev Sets a sender address of the failed message that came from the other side.
     * @param _messageId id of the message from the other side that triggered a call.
     * @param _sender address of the sender on the other side.
     */
    function setFailedMessageSender(bytes32 _messageId, address _sender) internal {
        addressStorage[keccak256(abi.encodePacked("failedMessageSender", _messageId))] = _sender;
    }

    /**
     * @dev Returns an address of the sender on the other side for the currently processed message.
     * Can be used by executors for getting other side caller address.
     * @return address of the sender on the other side.
     */
    function messageSender() external view returns (address) {
        return addressStorage[MESSAGE_SENDER];
    }

    /**
     * @dev Sets an address of the sender on the other side for the currently processed message.
     * @param _sender address of the sender on the other side.
     */
    function setMessageSender(address _sender) internal {
        addressStorage[MESSAGE_SENDER] = _sender;
    }

    /**
     * @dev Returns an id of the currently processed message.
     * @return id of the message that originated on the other side.
     */
    function messageId() public view returns (bytes32) {
        return bytes32(uintStorage[MESSAGE_ID]);
    }

    /**
     * @dev Returns an id of the currently processed message.
     * NOTE: transactionHash was used previously to identify incoming message before AMB message id was introduced.
     * It is kept for backwards compatibility with old mediators contracts, although it doesn't return txHash anymore.
     * @return id of the message that originated on the other side.
     */
    function transactionHash() external view returns (bytes32) {
        return messageId();
    }

    /**
     * @dev Sets a message id of the currently processed message.
     * @param _messageId id of the message that originated on the other side.
     */
    function setMessageId(bytes32 _messageId) internal {
        uintStorage[MESSAGE_ID] = uint256(_messageId);
    }

    /**
     * @dev Returns an originating chain id of the currently processed message.
     * @return source chain id of the message that originated on the other side.
     */
    function messageSourceChainId() external view returns (uint256) {
        return uintStorage[MESSAGE_SOURCE_CHAIN_ID];
    }

    /**
     * @dev Returns an originating chain id of the currently processed message.
     * @return source chain id of the message that originated on the other side.
     */
    function setMessageSourceChainId(uint256 _sourceChainId) internal returns (uint256) {
        uintStorage[MESSAGE_SOURCE_CHAIN_ID] = _sourceChainId;
    }

    /**
     * @dev Processes received message. Makes a call to the message executor,
     * sets dataHash, receive, sender variables for failed messages.
     * @param _sender sender address on the other side.
     * @param _executor address of an executor.
     * @param _messageId id of the processed message.
     * @param _gasLimit gas limit for a call to executor.
     * @param _sourceChainId source chain id is of the received message.
     * @param _data calldata for a call to executor.
     */
    function processMessage(
        address _sender,
        address _executor,
        bytes32 _messageId,
        uint256 _gasLimit,
        bytes1, /* dataType */
        uint256, /* gasPrice */
        uint256 _sourceChainId,
        bytes memory _data
    ) internal {
        bool status = _passMessage(_sender, _executor, _data, _gasLimit, _messageId, _sourceChainId);

        setMessageCallStatus(_messageId, status);
        if (!status) {
            setFailedMessageDataHash(_messageId, _data);
            setFailedMessageReceiver(_messageId, _executor);
            setFailedMessageSender(_messageId, _sender);
        }
        emitEventOnMessageProcessed(_sender, _executor, _messageId, status);
    }

    /**
     * @dev Makes a call to the message executor.
     * @param _sender sender address on the other side.
     * @param _contract address of an executor contract.
     * @param _data calldata for a call to executor.
     * @param _gas gas limit for a call to executor.
     * @param _messageId id of the processed message.
     * @param _sourceChainId source chain id is of the received message.
     */
    function _passMessage(
        address _sender,
        address _contract,
        bytes _data,
        uint256 _gas,
        bytes32 _messageId,
        uint256 _sourceChainId
    ) internal returns (bool) {
        setMessageSender(_sender);
        setMessageId(_messageId);
        setMessageSourceChainId(_sourceChainId);
        bool status = _contract.call.gas(_gas)(_data);
        setMessageSender(address(0));
        setMessageId(bytes32(0));
        setMessageSourceChainId(0);
        return status;
    }

    /* solcov ignore next */
    function emitEventOnMessageProcessed(
        address sender,
        address executor,
        bytes32 messageId,
        bool status
    ) internal;
}
