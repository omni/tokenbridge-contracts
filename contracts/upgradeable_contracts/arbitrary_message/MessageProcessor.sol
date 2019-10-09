pragma solidity 0.4.24;

import "../../upgradeability/EternalStorage.sol";
import "../../libraries/Bytes.sol";

contract MessageProcessor is EternalStorage {
    bytes32 internal constant MESSAGE_SENDER = 0x7b58b2a669d8e0992eae9eaef641092c0f686fd31070e7236865557fa1571b5b; // "messageSender"
    bytes32 internal constant TRANSACTION_HASH = 0x7bce44346b9831b0c81437a092605c6fc51612016e2c51e62f21d829e434bcf6; // "transactionHash"

    function messageCallStatus(bytes32 _txHash) external view returns (bool) {
        return boolStorage[keccak256(abi.encodePacked("messageCallStatus", _txHash))];
    }

    function setMessageCallStatus(bytes32 _txHash, bool _status) internal {
        boolStorage[keccak256(abi.encodePacked("messageCallStatus", _txHash))] = _status;
    }

    function failedMessageDataHash(bytes32 _txHash) external view returns (bytes32) {
        return Bytes.bytesToBytes32(bytesStorage[keccak256(abi.encodePacked("failedMessageDataHash", _txHash))]);
    }

    function setFailedMessageDataHash(bytes32 _txHash, bytes data) internal {
        bytesStorage[keccak256(abi.encodePacked("failedMessageDataHash", _txHash))] = abi.encodePacked(keccak256(data));
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

    function transactionHash() external view returns (bytes32) {
        return Bytes.bytesToBytes32(bytesStorage[TRANSACTION_HASH]);
    }

    function setTransactionHash(bytes32 _txHash) internal {
        bytesStorage[TRANSACTION_HASH] = abi.encodePacked(_txHash);
    }

    function processMessage(
        address sender,
        address executor,
        bytes32 txHash,
        uint256 gasLimit,
        bytes1, /* dataType */
        uint256, /* gasPrice */
        bytes memory data
    ) internal {
        bool status = _passMessage(sender, executor, data, gasLimit, txHash);

        setMessageCallStatus(txHash, status);
        if (!status) {
            setFailedMessageDataHash(txHash, data);
            setFailedMessageReceiver(txHash, executor);
            setFailedMessageSender(txHash, sender);
        }
        emitEventOnMessageProcessed(sender, executor, txHash, status);
    }

    function _passMessage(address _sender, address _contract, bytes _data, uint256 _gas, bytes32 _txHash)
        internal
        returns (bool)
    {
        setMessageSender(_sender);
        setTransactionHash(_txHash);
        bool status = _contract.call.gas(_gas)(_data);
        setMessageSender(address(0));
        setTransactionHash(bytes32(0));
        return status;
    }

    /* solcov ignore next */
    function emitEventOnMessageProcessed(address sender, address executor, bytes32 txHash, bool status) internal;
}
