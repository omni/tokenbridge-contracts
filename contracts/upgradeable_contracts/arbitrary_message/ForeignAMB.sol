pragma solidity 0.4.24;

import "./BasicForeignAMB.sol";


contract ForeignAMB is BasicForeignAMB {

    event UserRequestForAffirmation(bytes encodedData);
    event RelayedMessage(address sender, address executor, bytes32 transactionHash);

    function maxGasPerTx() public view returns(uint256) {
        return maxPerTx();
    }

    function messageProcessed(bytes32 _txHash) internal view returns(bool) {
        return relayedMessages(_txHash);
    }

    function isMessageDeliverySubsidizedMode() internal returns(bool) {
        return keccak256(foreignToHomeMode()) == keccak256(SUBSIDIZED_MODE);
    }

    function isMessageProcessorSubsidizedMode() internal returns(bool) {
        return keccak256(homeToForeignMode()) == keccak256(SUBSIDIZED_MODE);
    }

    function emitEventOnMessageRequest(bytes encodedData) internal {
        emit UserRequestForAffirmation(encodedData);
    }

    function emitEventOnMessageProcessed(address sender, address executor, bytes32 txHash) internal {
        emit RelayedMessage(sender, executor, txHash);
    }

    function setMessageProcessed(bytes32 _txHash, bool _status) internal {
        setRelayedMessages(_txHash, _status);
    }
}
