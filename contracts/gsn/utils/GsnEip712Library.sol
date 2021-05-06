// SPDX-License-Identifier:MIT
pragma solidity 0.4.24;
pragma experimental ABIEncoderV2;

import "../interfaces/GsnTypes.sol";
import "../interfaces/IRelayRecipient.sol";
import "../forwarder/IForwarder.sol";

/**
 * Bridge Library to map GSN RelayRequest into a call of a Forwarder
 */
library GsnEip712Library {
    //verify that the recipient trusts the given forwarder
    // MUST be called by paymaster
    function verifyForwarderTrusted(GsnTypes.RelayRequest relayRequest) internal view {
        require(IRelayRecipient(relayRequest.request.to).isTrustedForwarder(relayRequest.relayData.forwarder));
    }
}
