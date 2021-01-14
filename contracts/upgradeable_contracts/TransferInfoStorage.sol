pragma solidity 0.4.24;

import "../upgradeability/EternalStorage.sol";

contract TransferInfoStorage is EternalStorage {
    /**
    * @dev Stores the value of a message sent to the AMB bridge.
    * @param _messageId of the message sent to the bridge.
    * @param _value amount of tokens bridged.
    */
    function setMessageValue(bytes32 _messageId, uint256 _value) internal {
        uintStorage[keccak256(abi.encodePacked("messageValue", _messageId))] = _value;
    }

    /**
    * @dev Tells the amount of tokens of a message sent to the AMB bridge.
    * @return value representing amount of tokens.
    */
    function messageValue(bytes32 _messageId) internal view returns (uint256) {
        return uintStorage[keccak256(abi.encodePacked("messageValue", _messageId))];
    }

    /**
    * @dev Stores the receiver of a message sent to the AMB bridge.
    * @param _messageId of the message sent to the bridge.
    * @param _recipient receiver of the tokens bridged.
    */
    function setMessageRecipient(bytes32 _messageId, address _recipient) internal {
        addressStorage[keccak256(abi.encodePacked("messageRecipient", _messageId))] = _recipient;
    }

    /**
    * @dev Tells the receiver of a message sent to the AMB bridge.
    * @return address of the receiver.
    */
    function messageRecipient(bytes32 _messageId) internal view returns (address) {
        return addressStorage[keccak256(abi.encodePacked("messageRecipient", _messageId))];
    }

    /**
    * @dev Sets that the message sent to the AMB bridge has been fixed.
    * @param _messageId of the message sent to the bridge.
    */
    function setMessageFixed(bytes32 _messageId) internal {
        boolStorage[keccak256(abi.encodePacked("messageFixed", _messageId))] = true;
    }

    /**
    * @dev Tells if a message sent to the AMB bridge has been fixed.
    * @return bool indicating the status of the message.
    */
    function messageFixed(bytes32 _messageId) public view returns (bool) {
        return boolStorage[keccak256(abi.encodePacked("messageFixed", _messageId))];
    }
}
