pragma solidity 0.4.24;

import "./BasicHomeAMB.sol";

contract HomeAMB is BasicHomeAMB {
    event UserRequestForSignature(bytes encodedData);
    event AffirmationCompleted(address sender, address executor, bytes32 transactionHash, bool status);

    function getMaxGasPerTx() internal returns (uint256) {
        return maxGasPerTx();
    }

    function isMessageDeliverySubsidizedMode() internal returns (bool) {
        return homeToForeignMode() == SUBSIDIZED_MODE;
    }

    function emitEventOnMessageRequest(bytes encodedData) internal {
        emit UserRequestForSignature(encodedData);
    }

    function isMessageProcessorSubsidizedMode() internal returns (bool) {
        return foreignToHomeMode() == SUBSIDIZED_MODE;
    }

    function emitEventOnMessageProcessed(address sender, address executor, bytes32 txHash, bool status) internal {
        emit AffirmationCompleted(sender, executor, txHash, status);
    }
}
