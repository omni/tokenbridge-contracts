pragma solidity 0.4.24;

import "../../upgradeability/EternalStorage.sol";

/**
* @title MultiTokenNativeRegistry
* @dev Common functionality for keeping track of registered native tokens for multi-erc20-to-erc677 mediator.
*/
contract MultiTokenNativeRegistry is EternalStorage {
    /**
     * @dev Checks if a given token is a bridged token that is native to this side of the bridge.
     * @param _token address of token contract.
     * @return message id of the send message.
     */
    function isRegisteredAsNativeToken(address _token) public view returns (bool) {
        return tokenRegistrationMessageId(_token) != bytes32(0);
    }

    /**
     * @dev Returns message id where specified token was first seen and deploy on the other side was requested.
     * @param _token address of token contract.
     * @return message id of the send message.
     */
    function tokenRegistrationMessageId(address _token) public view returns (bytes32) {
        return bytes32(uintStorage[keccak256(abi.encodePacked("tokenRegistrationMessageId", _token))]);
    }

    /**
     * @dev Updates message id where specified token was first seen and deploy on the other side was requested.
     * @param _token address of token contract.
     * @param _messageId message id of the send message.
     */
    function _setTokenRegistrationMessageId(address _token, bytes32 _messageId) internal {
        uintStorage[keccak256(abi.encodePacked("tokenRegistrationMessageId", _token))] = uint256(_messageId);
    }
}
