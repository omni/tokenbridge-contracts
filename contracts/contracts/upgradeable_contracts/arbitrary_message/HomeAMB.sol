pragma solidity 0.4.24;

import "./BasicHomeAMB.sol";

contract HomeAMB is BasicHomeAMB {
    event UserRequestForSignature(bytes32 indexed messageId, bytes encodedData);
    event AffirmationCompleted(
        address indexed sender,
        address indexed executor,
        bytes32 indexed messageId,
        bool status
    );

    function emitEventOnMessageRequest(bytes32 messageId, bytes encodedData) internal {
        emit UserRequestForSignature(messageId, encodedData);
    }

    function emitEventOnMessageProcessed(
        address sender,
        address executor,
        bytes32 messageId,
        bool status
    ) internal {
        emit AffirmationCompleted(sender, executor, messageId, status);
    }
}
