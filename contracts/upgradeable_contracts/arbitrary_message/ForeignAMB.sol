pragma solidity 0.4.24;

import "../../libraries/Message.sol";
import "../../libraries/ArbitraryMessage.sol";
import "./BasicAMB.sol";
import "./MessageDelivery.sol";
import "../MessageRelay.sol";

contract ForeignAMB is BasicAMB, MessageRelay, MessageDelivery {
    event UserRequestForAffirmation(bytes32 indexed messageId, bytes encodedData);
    event RelayedMessage(address indexed sender, address indexed executor, bytes32 indexed messageId, bool status);

    /**
    * @dev Validates provided signatures and relays a given message
    * @param _data bytes to be relayed
    * @param _signatures bytes blob with signatures to be validated
    */
    function executeSignatures(bytes _data, bytes _signatures) external {
        Message.hasEnoughValidSignatures(_data, _signatures, validatorContract(), true);

        (bytes32 messageId, address sender, address executor, uint32 gasLimit, , uint256[2] memory chainIds, , uint256 offset) = ArbitraryMessage
            .unpackHeader(_data);
        require(_isMessageVersionValid(messageId));
        require(_isDestinationChainIdValid(chainIds[1]));
        require(!relayedMessages(messageId));
        setRelayedMessages(messageId, true);
        bytes memory payload = ArbitraryMessage.unpackPayload(_data, offset);
        processMessage(sender, executor, messageId, gasLimit, chainIds[0], payload);
    }

    /**
    * @dev Internal function for updating fallback gas price value.
    * @param _gasPrice new value for the gas price, zero gas price is not allowed.
    */
    function _setGasPrice(uint256 _gasPrice) internal {
        require(_gasPrice > 0);
        super._setGasPrice(_gasPrice);
    }

    function emitEventOnMessageRequest(bytes32 messageId, bytes encodedData) internal {
        emit UserRequestForAffirmation(messageId, encodedData);
    }

    function emitEventOnMessageProcessed(address sender, address executor, bytes32 messageId, bool status) internal {
        emit RelayedMessage(sender, executor, messageId, status);
    }
}
