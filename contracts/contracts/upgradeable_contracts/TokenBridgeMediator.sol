pragma solidity 0.4.24;

import "./BasicAMBMediator.sol";
import "./BasicTokenBridge.sol";
import "./TransferInfoStorage.sol";

/**
 * @title TokenBridgeMediator
 * @dev Common mediator functionality to handle operations related to token bridge messages sent to AMB bridge.
 */
contract TokenBridgeMediator is BasicAMBMediator, BasicTokenBridge, TransferInfoStorage {
    event FailedMessageFixed(bytes32 indexed messageId, address recipient, uint256 value);
    event TokensBridged(address indexed recipient, uint256 value, bytes32 indexed messageId);

    /**
     * @dev Call AMB bridge to require the invocation of handleBridgedTokens method of the mediator on the other network.
     * Store information related to the bridged tokens in case the message execution fails on the other network
     * and the action needs to be fixed/rolled back.
     * @param _from address of sender, if bridge operation fails, tokens will be returned to this address
     * @param _receiver address of receiver on the other side, will eventually receive bridged tokens
     * @param _value bridged amount of tokens
     */
    function passMessage(
        address _from,
        address _receiver,
        uint256 _value
    ) internal {
        bytes4 methodSelector = this.handleBridgedTokens.selector;
        bytes memory data = abi.encodeWithSelector(methodSelector, _receiver, _value);

        bytes32 _messageId = bridgeContract().requireToPassMessage(
            mediatorContractOnOtherSide(),
            data,
            requestGasLimit()
        );

        setMessageValue(_messageId, _value);
        setMessageRecipient(_messageId, _from);
    }

    /**
     * @dev Handles the bridged tokens. Checks that the value is inside the execution limits and invokes the method
     * to execute the Mint or Unlock accordingly.
     * @param _recipient address that will receive the tokens
     * @param _value amount of tokens to be received
     */
    function handleBridgedTokens(address _recipient, uint256 _value) external onlyMediator {
        if (withinExecutionLimit(_value)) {
            addTotalExecutedPerDay(getCurrentDay(), _value);
            executeActionOnBridgedTokens(_recipient, _value);
        } else {
            executeActionOnBridgedTokensOutOfLimit(_recipient, _value);
        }
    }

    /**
     * @dev Method to be called when a bridged message execution failed. It will generate a new message requesting to
     * fix/roll back the transferred assets on the other network.
     * @param _messageId id of the message which execution failed.
     */
    function requestFailedMessageFix(bytes32 _messageId) external {
        require(!bridgeContract().messageCallStatus(_messageId));
        require(bridgeContract().failedMessageReceiver(_messageId) == address(this));
        require(bridgeContract().failedMessageSender(_messageId) == mediatorContractOnOtherSide());

        bytes4 methodSelector = this.fixFailedMessage.selector;
        bytes memory data = abi.encodeWithSelector(methodSelector, _messageId);
        bridgeContract().requireToPassMessage(mediatorContractOnOtherSide(), data, requestGasLimit());
    }

    /**
     * @dev Handles the request to fix transferred assets which bridged message execution failed on the other network.
     * It uses the information stored by passMessage method when the assets were initially transferred
     * @param _messageId id of the message which execution failed on the other network.
     */
    function fixFailedMessage(bytes32 _messageId) external onlyMediator {
        require(!messageFixed(_messageId));

        address recipient = messageRecipient(_messageId);
        uint256 value = messageValue(_messageId);
        setMessageFixed(_messageId);
        executeActionOnFixedTokens(recipient, value);
        emit FailedMessageFixed(_messageId, recipient, value);
    }

    /* solcov ignore next */
    function executeActionOnBridgedTokensOutOfLimit(address _recipient, uint256 _value) internal;

    /* solcov ignore next */
    function executeActionOnBridgedTokens(address _recipient, uint256 _value) internal;

    /* solcov ignore next */
    function executeActionOnFixedTokens(address _recipient, uint256 _value) internal;
}
