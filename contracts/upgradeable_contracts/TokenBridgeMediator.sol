pragma solidity 0.4.24;

import "./BasicAMBMediator.sol";
import "./BasicTokenBridge.sol";

/**
* @title TokenBridgeMediator
* @dev Common mediator functionality to handle operations related to token bridge messages sent to AMB bridge.
*/
contract TokenBridgeMediator is BasicAMBMediator, BasicTokenBridge {
    event FailedMessageFixed(bytes32 indexed dataHash, address recipient, uint256 value);
    event TokensBridged(address indexed recipient, uint256 value, bytes32 indexed messageId);

    /**
    * @dev Stores the value related to the hash of a message sent to the AMB bridge.
    * @param _hash of the message sent to the bridge.
    * @param _value amount of tokens bridged.
    */
    function setMessageHashValue(bytes32 _hash, uint256 _value) internal {
        uintStorage[keccak256(abi.encodePacked("messageHashValue", _hash))] = _value;
    }

    /**
    * @dev Tells the amount of tokens related to the hash of a message sent to the AMB bridge.
    * @return value representing amount of tokens.
    */
    function messageHashValue(bytes32 _hash) internal view returns (uint256) {
        return uintStorage[keccak256(abi.encodePacked("messageHashValue", _hash))];
    }

    /**
    * @dev Stores the receiver related to the hash of a message sent to the AMB bridge.
    * @param _hash of the message sent to the bridge.
    * @param _recipient receiver of the tokens bridged.
    */
    function setMessageHashRecipient(bytes32 _hash, address _recipient) internal {
        addressStorage[keccak256(abi.encodePacked("messageHashRecipient", _hash))] = _recipient;
    }

    /**
    * @dev Tells the receiver related to the hash of a message sent to the AMB bridge.
    * @return address of the receiver.
    */
    function messageHashRecipient(bytes32 _hash) internal view returns (address) {
        return addressStorage[keccak256(abi.encodePacked("messageHashRecipient", _hash))];
    }

    /**
    * @dev Sets that the hash related to a message sent to the AMB bridge has been fixed.
    * @param _hash of the message sent to the bridge.
    */
    function setMessageHashFixed(bytes32 _hash) internal {
        boolStorage[keccak256(abi.encodePacked("messageHashFixed", _hash))] = true;
    }

    /**
    * @dev Tells if a message sent to the AMB bridge has been fixed.
    * @return bool indicating the status of the hash related to message.
    */
    function messageHashFixed(bytes32 _hash) public view returns (bool) {
        return boolStorage[keccak256(abi.encodePacked("messageHashFixed", _hash))];
    }

    /**
    * @dev Call AMB bridge to require the invocation of handleBridgedTokens method of the mediator on the other network.
    * Store information related to the bridged tokens in case the message execution fails on the other network
    * and the action needs to be fixed/rolled back.
    * @param _from address of sender, if bridge operation fails, tokens will be returned to this address
    * @param _receiver address of receiver on the other side, will eventually receive bridged tokens
    * @param _value bridged amount of tokens
    */
    function passMessage(address _from, address _receiver, uint256 _value) internal {
        bytes4 methodSelector = this.handleBridgedTokens.selector;
        bytes memory data = abi.encodeWithSelector(methodSelector, _receiver, _value, nonce());

        bytes32 dataHash = keccak256(data);
        setMessageHashValue(dataHash, _value);
        setMessageHashRecipient(dataHash, _from);
        setNonce(dataHash);

        bridgeContract().requireToPassMessage(mediatorContractOnOtherSide(), data, requestGasLimit());
    }

    /**
    * @dev Handles the bridged tokens. Checks that the value is inside the execution limits and invokes the method
    * to execute the Mint or Unlock accordingly.
    * nonce parameter is a unique message identifier on AMB bridge, it is not actually used by this method,
    * it serves as unique reference.
    * @param _recipient address that will receive the tokens
    * @param _value amount of tokens to be received
    */
    function handleBridgedTokens(
        address _recipient,
        uint256 _value,
        bytes32 /* nonce */
    ) external {
        require(msg.sender == address(bridgeContract()));
        require(messageSender() == mediatorContractOnOtherSide());
        if (withinExecutionLimit(_value)) {
            setTotalExecutedPerDay(getCurrentDay(), totalExecutedPerDay(getCurrentDay()).add(_value));
            executeActionOnBridgedTokens(_recipient, _value);
        } else {
            executeActionOnBridgedTokensOutOfLimit(_recipient, _value);
        }
    }

    /**
    * @dev Method to be called when a bridged message execution failed. It will generate a new message requesting to
    * fix/roll back the transferred assets on the other network.
    * @param _txHash transaction hash of the message which execution failed.
    */
    function requestFailedMessageFix(bytes32 _txHash) external {
        require(!bridgeContract().messageCallStatus(_txHash));
        require(bridgeContract().failedMessageReceiver(_txHash) == address(this));
        require(bridgeContract().failedMessageSender(_txHash) == mediatorContractOnOtherSide());
        bytes32 dataHash = bridgeContract().failedMessageDataHash(_txHash);

        bytes4 methodSelector = this.fixFailedMessage.selector;
        bytes memory data = abi.encodeWithSelector(methodSelector, dataHash);
        bridgeContract().requireToPassMessage(mediatorContractOnOtherSide(), data, requestGasLimit());
    }

    /**
    * @dev Handles the request to fix transferred assets which bridged message execution failed on the other network.
    * It uses the information stored by passMessage method when the assets were initially transferred
    * @param _dataHash hash of the message which execution failed on the other network.
    */
    function fixFailedMessage(bytes32 _dataHash) external {
        require(msg.sender == address(bridgeContract()));
        require(messageSender() == mediatorContractOnOtherSide());
        require(!messageHashFixed(_dataHash));

        address recipient = messageHashRecipient(_dataHash);
        uint256 value = messageHashValue(_dataHash);
        setMessageHashFixed(_dataHash);
        executeActionOnFixedTokens(recipient, value);
        emit FailedMessageFixed(_dataHash, recipient, value);
    }

    /* solcov ignore next */
    function executeActionOnBridgedTokensOutOfLimit(address _recipient, uint256 _value) internal;

    /* solcov ignore next */
    function executeActionOnBridgedTokens(address _recipient, uint256 _value) internal;

    /* solcov ignore next */
    function executeActionOnFixedTokens(address _recipient, uint256 _value) internal;
}
