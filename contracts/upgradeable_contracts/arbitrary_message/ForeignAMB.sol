pragma solidity 0.4.24;

import "./BasicForeignAMB.sol";

contract ForeignAMB is BasicForeignAMB {
    event UserRequestForAffirmation(bytes encodedData);
    event RelayedMessage(
        address indexed sender,
        address indexed executor,
        bytes32 indexed transactionHash,
        bool status
    );

    function emitEventOnMessageRequest(bytes encodedData) internal {
        emit UserRequestForAffirmation(encodedData);
    }

    function emitEventOnMessageProcessed(address sender, address executor, bytes32 txHash, bool status) internal {
        emit RelayedMessage(sender, executor, txHash, status);
    }
}
