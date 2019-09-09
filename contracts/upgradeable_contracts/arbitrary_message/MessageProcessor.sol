pragma solidity 0.4.24;

import "../../upgradeability/EternalStorage.sol";

contract MessageProcessor is EternalStorage {
    bytes32 internal constant MESSAGE_SENDER = keccak256(abi.encodePacked("messageSender"));
    bytes32 internal constant TRANSACTION_HASH = keccak256(abi.encodePacked("transactionHash"));

    function messageCallStatus(bytes32 _txHash) external view returns (bool) {
        return boolStorage[keccak256(abi.encodePacked("callStatus", _txHash))];
    }

    function setMessageCallStatus(bytes32 _txHash, bool _status) internal {
        boolStorage[keccak256(abi.encodePacked("callStatus", _txHash))] = _status;
    }

    function messageDataHash(bytes32 _txHash) external view returns (bytes32) {
        return bytesToBytes32(bytesStorage[keccak256(abi.encodePacked("dataHash", _txHash))]);
    }

    function setMessageDataHash(bytes32 _txHash, bytes data) internal {
        bytesStorage[keccak256(abi.encodePacked("dataHash", _txHash))] = abi.encodePacked(keccak256(data));
    }

    function messageSender() external view returns (address) {
        return addressStorage[MESSAGE_SENDER];
    }

    function setMessageSender(address _sender) internal {
        addressStorage[MESSAGE_SENDER] = _sender;
    }

    function transactionHash() external view returns (bytes32) {
        return bytesToBytes32(bytesStorage[TRANSACTION_HASH]);
    }

    function bytesToBytes32(bytes _txHash) internal view returns (bytes32 result) {
        assembly {
            result := mload(add(_txHash, 32))
        }
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
            setMessageDataHash(txHash, data);
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
