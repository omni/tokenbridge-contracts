pragma solidity 0.4.24;

import "./BasicHomeAMB.sol";

contract HomeAMB is BasicHomeAMB {
    event UserRequestForSignature(bytes encodedData);
    event AffirmationCompleted(
        address indexed sender,
        address indexed executor,
        bytes32 indexed transactionHash,
        bool status
    );

    function emitEventOnMessageRequest(bytes encodedData) internal {
        emit UserRequestForSignature(encodedData);
    }

    function emitEventOnMessageProcessed(address sender, address executor, bytes32 txHash, bool status) internal {
        emit AffirmationCompleted(sender, executor, txHash, status);
    }
}
