pragma solidity 0.4.24;

import "./BasicForeignAMB.sol";

contract ForeignAMB is BasicForeignAMB {
    event UserRequestForAffirmation(bytes32 indexed messageId, bytes encodedData);
    event RelayedMessage(address indexed sender, address indexed executor, bytes32 indexed messageId, bool status);

    function emitEventOnMessageRequest(bytes32 messageId, bytes encodedData) internal {
        emit UserRequestForAffirmation(messageId, encodedData);
    }

    function emitEventOnMessageProcessed(address sender, address executor, bytes32 messageId, bool status) internal {
        emit RelayedMessage(sender, executor, messageId, status);
    }
}
