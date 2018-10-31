pragma solidity 0.4.24;

import "./BasicHomeAMB.sol";
import "./MessageDelivery.sol";


contract HomeAMB is BasicHomeAMB, MessageDelivery {

    event UserRequestForSignature(bytes encodedData);

    function isSubsidizedMode() internal returns(bool) {
        return keccak256(homeToForeignMode()) == keccak256(SUBSIDIZED_MODE);
    }

    function emitEventOnMessageReceived(bytes encodedData) internal {
        emit UserRequestForSignature(encodedData);
    }

    function maxGasPerTx() public view returns(uint256) {
        return maxPerTx();
    }
}
