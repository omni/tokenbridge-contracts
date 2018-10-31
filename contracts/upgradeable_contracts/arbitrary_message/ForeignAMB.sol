pragma solidity 0.4.24;

import "./BasicForeignAMB.sol";
import "./MessageDelivery.sol";


contract ForeignAMB is BasicForeignAMB, MessageDelivery {

    event UserRequestForAffirmation(bytes encodedData);

    function isSubsidizedMode() internal returns(bool) {
        return keccak256(foreignToHomeMode()) == keccak256(SUBSIDIZED_MODE);
    }

    function emitEventOnMessageReceived(bytes encodedData) internal {
        emit UserRequestForAffirmation(encodedData);
    }

    function maxGasPerTx() public view returns(uint256) {
        return maxPerTx();
    }
}
