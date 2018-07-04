pragma solidity 0.4.24;

import "../upgradeability/EternalStorage.sol";
import "../libraries/SafeMath.sol";
import "openzeppelin-solidity/contracts/token/ERC20/ERC20Basic.sol";
import "./Validatable.sol";
import "../libraries/Message.sol";

contract BasicHomeBridge is EternalStorage, Validatable {
    using SafeMath for uint256;

    event UserRequestForSignature(address recipient, uint256 value);
    event AffirmationCompleted (address recipient, uint256 value, bytes32 transactionHash);
    event SignedForUserRequest(address indexed signer, bytes32 messageHash);
    event SignedForAffirmation(address indexed signer, bytes32 transactionHash);
    event CollectedSignatures(address authorityResponsibleForRelay, bytes32 messageHash, uint256 NumberOfCollectedSignatures);

    function executeAffirmation(address recipient, uint256 value, bytes32 transactionHash) external onlyValidator {
        bytes32 hashMsg = keccak256(abi.encodePacked(recipient, value, transactionHash));
        bytes32 hashSender = keccak256(abi.encodePacked(msg.sender, hashMsg));
        // Duplicated affirmations
        require(!affirmationsSigned(hashSender));
        setAffirmationsSigned(hashSender, true);

        uint256 signed = numAffirmationsSigned(hashMsg);
        require(!isAlreadyProcessed(signed));
        // the check above assumes that the case when the value could be overflew will not happen in the addition operation below
        signed = signed + 1;

        setNumAffirmationsSigned(hashMsg, signed);

        emit SignedForAffirmation(msg.sender, transactionHash);

        if (signed >= requiredSignatures()) {
            // If the bridge contract does not own enough tokens to transfer
            // it will couse funds lock on the home side of the bridge
            setNumAffirmationsSigned(hashMsg, markAsProcessed(signed));
            require(onExecuteAffirmation(recipient, value));
            emit AffirmationCompleted(recipient, value, transactionHash);
        }
    }

    function submitSignature(bytes signature, bytes message) external onlyValidator {
        // ensure that `signature` is really `message` signed by `msg.sender`
        require(Message.isMessageValid(message));
        require(msg.sender == Message.recoverAddressFromSignedMessage(signature, message));
        bytes32 hashMsg = keccak256(abi.encodePacked(message));
        bytes32 hashSender = keccak256(abi.encodePacked(msg.sender, hashMsg));

        uint256 signed = numMessagesSigned(hashMsg);
        require(!isAlreadyProcessed(signed));
        // the check above assumes that the case when the value could be overflew will not happen in the addition operation below
        signed = signed + 1;
        if (signed > 1) {
            // Duplicated signatures
            require(!messagesSigned(hashSender));
        } else {
            setMessages(hashMsg, message);
        }
        setMessagesSigned(hashSender, true);

        bytes32 signIdx = keccak256(abi.encodePacked(hashMsg, (signed-1)));
        setSignatures(signIdx, signature);

        setNumMessagesSigned(hashMsg, signed);

        emit SignedForUserRequest(msg.sender, hashMsg);

        uint256 reqSigs = requiredSignatures();
        if (signed >= reqSigs) {
            setNumMessagesSigned(hashMsg, markAsProcessed(signed));
            emit CollectedSignatures(msg.sender, hashMsg, reqSigs);
        }
    }

    function setMessagesSigned(bytes32 _hash, bool _status) internal {
        boolStorage[keccak256(abi.encodePacked("messagesSigned", _hash))] = _status;
    }

    function onExecuteAffirmation(address, uint256) internal returns(bool) {
    }

    function numAffirmationsSigned(bytes32 _withdrawal) public view returns(uint256) {
        return uintStorage[keccak256(abi.encodePacked("numAffirmationsSigned", _withdrawal))];
    }

    function setAffirmationsSigned(bytes32 _withdrawal, bool _status) internal {
        boolStorage[keccak256(abi.encodePacked("affirmationsSigned", _withdrawal))] = _status;
    }

    function setNumAffirmationsSigned(bytes32 _withdrawal, uint256 _number) internal {
        uintStorage[keccak256(abi.encodePacked("numAffirmationsSigned", _withdrawal))] = _number;
    }

    function affirmationsSigned(bytes32 _withdrawal) public view returns(bool) {
        return boolStorage[keccak256(abi.encodePacked("affirmationsSigned", _withdrawal))];
    }

    function signature(bytes32 _hash, uint256 _index) public view returns (bytes) {
        bytes32 signIdx = keccak256(abi.encodePacked(_hash, _index));
        return signatures(signIdx);
    }

    function messagesSigned(bytes32 _message) public view returns(bool) {
        return boolStorage[keccak256(abi.encodePacked("messagesSigned", _message))];
    }

    function messages(bytes32 _hash) internal view returns(bytes) {
        return bytesStorage[keccak256(abi.encodePacked("messages", _hash))];
    }

    function signatures(bytes32 _hash) internal view returns(bytes) {
        return bytesStorage[keccak256(abi.encodePacked("signatures", _hash))];
    }

    function setSignatures(bytes32 _hash, bytes _signature) internal {
        bytesStorage[keccak256(abi.encodePacked("signatures", _hash))] = _signature;
    }

    function setMessages(bytes32 _hash, bytes _message) internal {
        bytesStorage[keccak256(abi.encodePacked("messages", _hash))] = _message;
    }

    function message(bytes32 _hash) public view returns (bytes) {
        return messages(_hash);
    }

    function setNumMessagesSigned(bytes32 _message, uint256 _number) internal {
        uintStorage[keccak256(abi.encodePacked("numMessagesSigned", _message))] = _number;
    }

    function markAsProcessed(uint256 _v) internal pure returns(uint256) {
        return _v | 2 ** 255;
    }

    function isAlreadyProcessed(uint256 _number) public pure returns(bool) {
        return _number & 2**255 == 2**255;
    }

    function numMessagesSigned(bytes32 _message) public view returns(uint256) {
        return uintStorage[keccak256(abi.encodePacked("numMessagesSigned", _message))];
    }


}
