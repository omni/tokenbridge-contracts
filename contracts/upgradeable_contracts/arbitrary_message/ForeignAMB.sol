pragma solidity 0.4.24;

import "./BasicForeignAMB.sol";

contract ForeignAMB is BasicForeignAMB {
    event UserRequestForAffirmation(bytes encodedData);
    event RelayedMessage(address sender, address executor, bytes32 transactionHash, bool status);

    function getMaxGasPerTx() internal returns (uint256) {
        return maxGasPerTx();
    }

    function messageProcessed(bytes32 _txHash) internal view returns (bool) {
        return relayedMessages(_txHash);
    }

    function isMessageDeliverySubsidizedMode() internal returns (bool) {
        return foreignToHomeMode() == SUBSIDIZED_MODE;
    }

    function isMessageProcessorSubsidizedMode() internal returns (bool) {
        return homeToForeignMode() == SUBSIDIZED_MODE;
    }

    function emitEventOnMessageRequest(bytes encodedData) internal {
        emit UserRequestForAffirmation(encodedData);
    }

    function emitEventOnMessageProcessed(address sender, address executor, bytes32 txHash, bool status) internal {
        emit RelayedMessage(sender, executor, txHash, status);
    }

    function setMessageProcessed(bytes32 _txHash, bool _status) internal {
        setRelayedMessages(_txHash, _status);
    }
}
