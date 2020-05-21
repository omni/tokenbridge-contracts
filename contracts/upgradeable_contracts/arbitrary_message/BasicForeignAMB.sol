pragma solidity 0.4.24;

import "../../libraries/Message.sol";
import "../../libraries/ArbitraryMessage.sol";
import "./BasicAMB.sol";
import "./MessageDelivery.sol";
import "./MessageProcessor.sol";
import "../MessageRelay.sol";

contract BasicForeignAMB is BasicAMB, MessageRelay, MessageDelivery, MessageProcessor {
    /**
    * @dev Validates provided signatures and relays a given message
    * @param _data bytes to be relayed
    * @param _signatures bytes blob with signatures to be validated
    */
    function executeSignatures(bytes _data, bytes _signatures) external {
        Message.hasEnoughValidSignatures(_data, _signatures, validatorContract(), true);

        bytes32 messageId;
        uint256 chainId;
        address sender;
        address executor;
        uint32 gasLimit;
        bytes1 dataType;
        uint256 gasPrice;
        bytes memory data;

        (messageId, chainId, sender, executor, gasLimit, dataType, gasPrice, data) = ArbitraryMessage.unpackData(
            _data,
            true
        );
        _validateMessageId(messageId);
        require(!relayedMessages(messageId));
        setRelayedMessages(messageId, true);
        processMessage(sender, executor, messageId, gasLimit, dataType, gasPrice, data);
    }
}
