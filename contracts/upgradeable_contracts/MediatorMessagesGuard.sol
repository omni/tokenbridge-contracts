pragma solidity 0.4.24;

import "../upgradeability/EternalStorage.sol";

/**
* @title MediatorMessagesGuard
* @dev AMB bridge supports one message per transaction. This contract provides functionality to limit the number of
* messages that a mediator can send to the bridge on a single transaction.
*/
contract MediatorMessagesGuard is EternalStorage {
    bytes32 private constant MESSAGES_CONTROL_BITMAP = 0x3caea4a73ee3aee2c0babf273b625b68b12a4f38d694d7cb051cb4b944e5e802; // keccak256(abi.encodePacked("messagesControlBitmap"))

    /**
    * @dev Tells the status of the lock.
    * @return the status of the lock.
    */
    function getMessagesControlBitmap() private view returns (uint256) {
        return uintStorage[MESSAGES_CONTROL_BITMAP];
    }

    /**
    * @dev Sets the status of the lock.
    * @param _bitmap the new status for the lock
    */
    function setMessagesControlBitmap(uint256 _bitmap) private {
        uintStorage[MESSAGES_CONTROL_BITMAP] = _bitmap;
    }

    /**
    * @dev Tells if messages are restricted and the limit was reached.
    * @param _bitmap the status of the lock
    */
    function messagesRestrictedAndLimitReached(uint256 _bitmap) private pure returns (bool) {
        return (_bitmap == ((2**255) | 1));
    }

    /**
    * @dev Tells if messages are restricted.
    * @param _bitmap the status of the lock
    */
    function messagesRestricted(uint256 _bitmap) private pure returns (bool) {
        return (_bitmap == 2**255);
    }

    /**
    * @dev Enable the lock to limit the number of messages to send to the AMB bridge
    */
    function enableMessagesRestriction() internal {
        setMessagesControlBitmap(2**255);
    }

    /**
    * @dev Disable the lock to limit the number of messages to send to the AMB bridge
    */
    function disableMessagesRestriction() internal {
        setMessagesControlBitmap(0);
    }

    modifier bridgeMessageAllowed {
        uint256 bm = getMessagesControlBitmap();
        require(!messagesRestrictedAndLimitReached(bm));
        if (messagesRestricted(bm)) {
            setMessagesControlBitmap(bm | 1);
        }
        /* solcov ignore next */
        _;
    }
}
