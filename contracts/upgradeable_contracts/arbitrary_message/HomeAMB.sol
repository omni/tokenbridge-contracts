pragma solidity 0.4.24;

import "./BasicHomeAMB.sol";


contract HomeAMB is BasicHomeAMB {

    event UserRequestForSignature(bytes encodedData);
    event AffirmationCompleted(address sender, address executor, bytes32 txHash);

    function maxGasPerTx() public view returns(uint256) {
        return maxPerTx();
    }

    function isMessageDeliverySubsidizedMode() internal returns(bool) {
        return keccak256(homeToForeignMode()) == keccak256(SUBSIDIZED_MODE);
    }

    function emitEventOnMessageRequest(bytes encodedData) internal {
        emit UserRequestForSignature(encodedData);
    }

    function isMessageProcessorSubsidizedMode() internal returns(bool) {
        return keccak256(foreignToHomeMode()) == keccak256(SUBSIDIZED_MODE);
    }

    function emitEventOnMessageProcessed(address sender, address executor, bytes32 txHash) internal {
        emit AffirmationCompleted(sender, executor, txHash);
    }
}
