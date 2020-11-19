pragma solidity 0.4.24;

import "../../interfaces/ERC677.sol";
import "./BasicMultiTokenBridge.sol";
import "../BasicAMBMediator.sol";
import "../ChooseReceiverHelper.sol";
import "../TransferInfoStorage.sol";

/**
* @title MultiTokenBridgeMediator
* @dev Common mediator functionality to handle operations related to multi-token bridge messages sent to AMB bridge.
*/
contract MultiTokenBridgeMediator is
    BasicAMBMediator,
    BasicMultiTokenBridge,
    TransferInfoStorage,
    ChooseReceiverHelper
{
    event FailedMessageFixed(bytes32 indexed messageId, address token, address recipient, uint256 value);
    event TokensBridgingInitiated(
        address indexed token,
        address indexed sender,
        uint256 value,
        bytes32 indexed messageId
    );
    event TokensBridged(address indexed token, address indexed recipient, uint256 value, bytes32 indexed messageId);

    /**
    * @dev Stores the bridged token of a message sent to the AMB bridge.
    * @param _messageId of the message sent to the bridge.
    * @param _token bridged token address.
    */
    function setMessageToken(bytes32 _messageId, address _token) internal {
        addressStorage[keccak256(abi.encodePacked("messageToken", _messageId))] = _token;
    }

    /**
    * @dev Tells the bridged token address of a message sent to the AMB bridge.
    * @return address of a token contract.
    */
    function messageToken(bytes32 _messageId) internal view returns (address) {
        return addressStorage[keccak256(abi.encodePacked("messageToken", _messageId))];
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
    function fixFailedMessage(bytes32 _messageId) public onlyMediator {
        require(!messageFixed(_messageId));

        address token = messageToken(_messageId);
        address recipient = messageRecipient(_messageId);
        uint256 value = messageValue(_messageId);
        setMessageFixed(_messageId);
        executeActionOnFixedTokens(_messageId, token, recipient, value);
        emit FailedMessageFixed(_messageId, token, recipient, value);
    }

    /* solcov ignore next */
    function executeActionOnFixedTokens(bytes32 _messageId, address _token, address _recipient, uint256 _value)
        internal;
}
