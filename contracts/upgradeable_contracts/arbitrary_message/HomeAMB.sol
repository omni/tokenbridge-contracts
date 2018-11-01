pragma solidity 0.4.24;

import "./BasicHomeAMB.sol";


contract HomeAMB is BasicHomeAMB {

    event UserRequestForSignature(bytes encodedData);

    function isMessageDeliverySubsidizedMode() internal returns(bool) {
        return keccak256(homeToForeignMode()) == keccak256(SUBSIDIZED_MODE);
    }

    function emitEventOnMessageRequest(bytes encodedData) internal {
        emit UserRequestForSignature(encodedData);
    }

    function maxGasPerTx() public view returns(uint256) {
        return maxPerTx();
    }
}
