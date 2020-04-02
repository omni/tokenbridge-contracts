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
    bytes32 private constant BRIDGE_MESSAGE_LIMIT_REACHED = 0x9fc9eb8bbe605baeeff607a74c3338dbf768244599c53ece5c90cc940a0af581; // keccak256(abi.encodePacked("bridgeMessageLimitReached"))

    /**
    * @dev Tells the status of the lock.
    * @return true if the number of messages are limited.
    */
    function bridgeMessageLock() private returns (bool) {
        return boolStorage[BRIDGE_MESSAGE_LOCK];
    }

    /**
    * @dev Sets the status of the lock.
    * @param _lock the new status for the lock
    */
    function setBridgeMessageLock(bool _lock) private {
        boolStorage[BRIDGE_MESSAGE_LOCK] = _lock;
    }

    /**
    * @dev Tells if the limit number of messages that were sent to the AMB bridge so far in the transaction was reached
    * @return the status of the message limit
    */
    function bridgeMessageLimitReached() private returns (bool) {
        return boolStorage[BRIDGE_MESSAGE_LIMIT_REACHED];
    }

    /**
    * @dev Sets the status of the limit of messages that were sent to the AMB bridge so far in the transaction.
    * @param _status the new status of the message limit
    */
    function setBridgeMessageLimitReached(bool _status) private {
        boolStorage[BRIDGE_MESSAGE_LIMIT_REACHED] = _status;
    }

    /**
    * @dev Enable the lock to limit the number of messages to send to the AMB bridge
    */
    function lockBridgeMessages() internal {
        setBridgeMessageLock(true);
        setBridgeMessageLimitReached(false);
    }

    /**
    * @dev Remove the lock to limit the number of messages to send to the AMB bridge
    */
    function unlockBridgeMessages() internal {
        setBridgeMessageLock(false);
    }

    modifier bridgeMessageAllowed {
        if (bridgeMessageLock()) {
            require(!bridgeMessageLimitReached());
            setBridgeMessageLimitReached(true);
        }
        /* solcov ignore next */
        _;
    }
}
