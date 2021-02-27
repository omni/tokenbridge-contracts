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
        // this checks prevents execution of other messages, while some other message is being processed
        // nested executeSignatures is considered to be unsafe,
        // since it allows to change/reset the AMB context variables (messageId, messageSender, messageSourceChainId)
        // while processing nested message
        require(messageId() == bytes32(0));

        Message.hasEnoughValidSignatures(_data, _signatures, validatorContract(), true);

        bytes32 msgId;
        address sender;
        address executor;
        uint32 gasLimit;
        uint8 dataType;
        uint256[2] memory chainIds;
        bytes memory data;

        (msgId, sender, executor, gasLimit, dataType, chainIds, data) = ArbitraryMessage.unpackData(_data);

        require(_isMessageVersionValid(msgId));
        require(_isDestinationChainIdValid(chainIds[1]));
        require(!relayedMessages(msgId));
        setRelayedMessages(msgId, true);
        processMessage(sender, executor, msgId, gasLimit, dataType, chainIds[0], data);
    }

    /**
    * @dev Internal function for updating fallback gas price value.
    * @param _gasPrice new value for the gas price, zero gas price is not allowed.
    */
    function _setGasPrice(uint256 _gasPrice) internal {
        require(_gasPrice > 0);
        super._setGasPrice(_gasPrice);
    }
}
