pragma solidity 0.4.24;

import "../../upgradeability/EternalStorage.sol";
import "../../libraries/Bytes.sol";

contract MessageProcessor is EternalStorage {
    bytes32 internal constant MESSAGE_SENDER = 0x7b58b2a669d8e0992eae9eaef641092c0f686fd31070e7236865557fa1571b5b; // keccak256(abi.encodePacked("messageSender"))
    bytes32 internal constant TRANSACTION_HASH = 0x7bce44346b9831b0c81437a092605c6fc51612016e2c51e62f21d829e434bcf6; // keccak256(abi.encodePacked("transactionHash"))

    function messageCallStatus(bytes32 _txHash) external view returns (bool) {
        return boolStorage[keccak256(abi.encodePacked("messageCallStatus", _txHash))];
    }

    function setMessageCallStatus(bytes32 _txHash, bool _status) internal {
        boolStorage[keccak256(abi.encodePacked("messageCallStatus", _txHash))] = _status;
    }

    function failedMessageReceiver(bytes32 _txHash) external view returns (address) {
        return addressStorage[keccak256(abi.encodePacked("failedMessageReceiver", _txHash))];
    }

    function setFailedMessageReceiver(bytes32 _txHash, address _receiver) internal {
        addressStorage[keccak256(abi.encodePacked("failedMessageReceiver", _txHash))] = _receiver;
    }

    function failedMessageSender(bytes32 _txHash) external view returns (address) {
        return addressStorage[keccak256(abi.encodePacked("failedMessageSender", _txHash))];
    }

    function setFailedMessageSender(bytes32 _txHash, address _sender) internal {
        addressStorage[keccak256(abi.encodePacked("failedMessageSender", _txHash))] = _sender;
    }

    function messageSender() external view returns (address) {
        return addressStorage[MESSAGE_SENDER];
    }

    function setMessageSender(address _sender) internal {
        addressStorage[MESSAGE_SENDER] = _sender;
    }

    function messageId() external view returns (bytes32) {
        return bytes32(uintStorage[TRANSACTION_HASH]);
    }

    function setMessageId(bytes32 _messageId) internal {
        uintStorage[TRANSACTION_HASH] = uint256(_messageId);
    }

    function processMessage(
        address _sender,
        address _executor,
        bytes32 _messageId,
        uint256 _gasLimit,
        bytes1, /* dataType */
        uint256, /* gasPrice */
        bytes memory _data
    ) internal {
        bool status = _passMessage(_sender, _executor, _data, _gasLimit, _messageId);

        setMessageCallStatus(_messageId, status);
        if (!status) {
            setFailedMessageReceiver(_messageId, _executor);
            setFailedMessageSender(_messageId, _sender);
        }
        emitEventOnMessageProcessed(_sender, _executor, _messageId, status);
    }

    function _passMessage(address _sender, address _contract, bytes _data, uint256 _gas, bytes32 _messageId)
        internal
        returns (bool)
    {
        setMessageSender(_sender);
        setMessageId(_messageId);
        bool status = _contract.call.gas(_gas)(_data);
        setMessageSender(address(0));
        setMessageId(bytes32(0));
        return status;
    }

    /* solcov ignore next */
    function emitEventOnMessageProcessed(address sender, address executor, bytes32 txHash, bool status) internal;
}
