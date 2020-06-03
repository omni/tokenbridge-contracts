pragma solidity 0.4.24;

import "../../libraries/Message.sol";
import "../../libraries/ArbitraryMessage.sol";
import "./BasicAMB.sol";
import "./MessageDelivery.sol";
import "../MessageRelay.sol";

contract BasicForeignAMB is BasicAMB, MessageRelay, MessageDelivery {
    /**
    * @dev Validates provided signatures and relays a given message
    * @param _data bytes to be relayed
    * @param _signatures bytes blob with signatures to be validated
    */
    function executeSignatures(bytes _data, bytes _signatures) external {
        Message.hasEnoughValidSignatures(_data, _signatures, validatorContract(), true);

        bytes32 messageId;
        address sender;
        address executor;
        uint32 gasLimit;
        bytes1 dataType;
        uint256[2] memory chainIds;
        uint256 gasPrice;
        bytes memory data;

        (messageId, sender, executor, gasLimit, dataType, chainIds, gasPrice, data) = ArbitraryMessage.unpackData(
            _data
        );
        require(_isMessageVersionValid(messageId));
        require(_isDestinationChainIdValid(chainIds[1]));
        require(!relayedMessages(messageId));
        setRelayedMessages(messageId, true);
        processMessage(sender, executor, messageId, gasLimit, dataType, gasPrice, chainIds[0], data);
    }
}
