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
    function executeSignatures(bytes _data, bytes _signatures) public {
        _allowMessageExecution(_data, _signatures);

        bytes32 msgId;
        address sender;
        address executor;
        uint32 gasLimit;
        uint8 dataType;
        uint256[2] memory chainIds;
        bytes memory data;

        (msgId, sender, executor, gasLimit, dataType, chainIds, data) = ArbitraryMessage.unpackData(_data);

        _executeMessage(msgId, sender, executor, gasLimit, dataType, chainIds, data);
    }

    /**
    * @dev Validates provided signatures and relays a given message.
    * The message is not allowed to fail. The whole tx will be revered if message fails.
    * @param _data bytes to be relayed
    * @param _signatures bytes blob with signatures to be validated
    */
    function safeExecuteSignatures(bytes _data, bytes _signatures) external {
        executeSignatures(_data, _signatures);
    }

    /**
    * @dev Validates provided signatures and relays a given message. Allows to override the gas limit of the passed message.
    * Usually it makes sense to provide a higher amount of gas for the execution.
    * The message is not allowed to fail. The whole tx will be revered if message fails.
    * @param _data bytes to be relayed
    * @param _signatures bytes blob with signatures to be validated
    */
    function safeExecuteSignaturesWithGasLimit(bytes _data, bytes _signatures, uint32 _gas) public {
        _allowMessageExecution(_data, _signatures);

        bytes32 msgId;
        address sender;
        address executor;
        uint8 dataType;
        uint256[2] memory chainIds;
        bytes memory data;

        (msgId, sender, executor, , dataType, chainIds, data) = ArbitraryMessage.unpackData(_data);

        _executeMessage(msgId, sender, executor, _gas, dataType, chainIds, data);
    }

    /**
    * @dev Validates provided signatures and relays a given message. Passes all available gas for the execution.
    * The message is not allowed to fail. The whole tx will be revered if message fails.
    * @param _data bytes to be relayed
    * @param _signatures bytes blob with signatures to be validated
    */
    function safeExecuteSignaturesWithAutoGasLimit(bytes _data, bytes _signatures) external {
        safeExecuteSignaturesWithGasLimit(_data, _signatures, 0xffffffff);
    }

    /**
    * @dev Internal function for validating pre-execution requirements.
    * @param _data bytes to be relayed.
    * @param _signatures bytes blob with signatures to be validated.
    */
    function _allowMessageExecution(bytes _data, bytes _signatures) internal {
        // this checks prevents execution of other messages, while some other message is being processed
        // nested executeSignatures is considered to be unsafe,
        // since it allows to change/reset the AMB context variables (messageId, messageSender, messageSourceChainId)
        // while processing nested message
        require(messageId() == bytes32(0));

        Message.hasEnoughValidSignatures(_data, _signatures, validatorContract(), true);
    }

    /**
    * @dev Internal function for executing decoded message. Performs additional validation on the message fields.
    * @param msgId id of the processed message.
    * @param sender sender address on the other side.
    * @param executor address of an executor.
    * @param gasLimit gas limit for a call to executor.
    * @param dataType AMB message dataType to be included as a part of the header.
    * @param chainIds pair of source and destination chain ids.
    * @param data calldata for a call to executor.
    */
    function _executeMessage(
        bytes32 msgId,
        address sender,
        address executor,
        uint32 gasLimit,
        uint8 dataType,
        uint256[2] memory chainIds,
        bytes memory data
    ) internal {
        require(_isMessageVersionValid(msgId));
        require(_isDestinationChainIdValid(chainIds[1]));
        require(!relayedMessages(msgId));
        setRelayedMessages(msgId, true);
        processMessage(sender, executor, msgId, gasLimit, dataType, chainIds[0], data);
    }

    /**
    * @dev Validates message execution status. Reverts if message is was executed in safe mode and reverted.
    * @param _status message execution status.
    */
    function _validateExecutionStatus(bool _status) internal {
        require(_status || msg.sig == this.executeSignatures.selector);
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
