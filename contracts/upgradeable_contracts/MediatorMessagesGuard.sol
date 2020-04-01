pragma solidity 0.4.24;

import "../upgradeability/EternalStorage.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";

/**
* @title MediatorMessagesGuard
* @dev AMB bridge supports one message per transaction. This contract provides functionality to limit the number of
* messages that a mediator can send to the bridge on a single transaction.
*/
contract MediatorMessagesGuard is EternalStorage {
    using SafeMath for uint256;

    bytes32 private constant BRIDGE_MESSAGE_LOCK = 0x0ee06820811e91be37ae8d7f20d6dccd5bda0f24b568acdd4e2499013b53fc5f; // keccak256(abi.encodePacked("bridgeMessageLock"))
    bytes32 private constant BRIDGE_MESSAGE_COUNT = 0x3098c7acc05e551de5fd23fd7e98995b3075446f642aecf18368e54c9d5af3b8; // keccak256(abi.encodePacked("bridgeMessageCount"))
    uint256 private constant BRIDGE_MESSAGE_COUNT_LIMIT = 1;

    /**
    * @dev Tells the status of the lock.
    * @return true if the number of messages are limited.
    */
    function bridgeMessageLock() private returns (bool) {
        return boolStorage[BRIDGE_MESSAGE_LOCK];
    }

    /**
    * @dev Sets the status of the lock.
    * @param the new status for the lock
    */
    function setBridgeMessageLock(bool _lock) private {
        boolStorage[BRIDGE_MESSAGE_LOCK] = _lock;
    }

    /**
    * @dev Tells the number of messages that were send to the AMB bridge so far in the transaction.
    * @return the number of messages
    */
    function bridgeMessageCount() private returns (uint256) {
        return uintStorage[BRIDGE_MESSAGE_COUNT];
    }

    /**
    * @dev Sets the number of messages that were send to the AMB bridge so far in the transaction.
    * @return the number of messages
    */
    function setBridgeMessageCount(uint256 _count) private {
        uintStorage[BRIDGE_MESSAGE_COUNT] = _count;
    }

    /**
    * @dev Enable the lock to limit the number of messages to send to the AMB bridge
    */
    function lockBridgeMessages() internal {
        setBridgeMessageLock(true);
        setBridgeMessageCount(0);
    }

    /**
    * @dev Remove the lock to limit the number of messages to send to the AMB bridge
    */
    function unlockBridgeMessages() internal {
        setBridgeMessageLock(false);
    }

    modifier bridgeMessageAllowed {
        if (bridgeMessageLock()) {
            uint256 nextMessageCount = bridgeMessageCount().add(1);
            require(nextMessageCount <= BRIDGE_MESSAGE_COUNT_LIMIT);
            setBridgeMessageCount(nextMessageCount);
        }
        /* solcov ignore next */
        _;
    }
}
