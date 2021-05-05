pragma solidity 0.4.24;

import "../../interfaces/IAMBInformationReceiver.sol";
import "./BasicHomeAMB.sol";

/**
 * @title AsyncInformationProcessor
 * @dev Functionality for making and processing async calls on Home side of the AMB.
 */
contract AsyncInformationProcessor is BasicHomeAMB {
    event UserRequestForInformation(
        bytes32 indexed messageId,
        bytes32 indexed requestSelector,
        address indexed sender,
        bytes data
    );
    event SignedForInformation(address indexed signer, bytes32 indexed messageId);
    event InformationRetrieved(bytes32 indexed messageId, bool status, bool callbackStatus);
    event EnabledAsyncRequestSelector(bytes32 indexed requestSelector, bool enable);

    /**
     * @dev Makes an asynchronous request to get information from the opposite network.
     * Call result will be returned later to the callee, by using the onInformationReceived(bytes) callback function.
     * @param _requestSelector selector for the async request.
     * @param _data payload for the given selector
     */
    function requireToGetInformation(bytes32 _requestSelector, bytes _data) external returns (bytes32) {
        // it is not allowed to pass messages while other messages are processed
        // if other is not explicitly configured
        require(messageId() == bytes32(0) || allowReentrantRequests());
        // only contracts are allowed to call this method, since EOA won't be able to receive a callback.
        require(AddressUtils.isContract(msg.sender));

        require(isAsyncRequestSelectorEnabled(_requestSelector));

        bytes32 _messageId = _getNewMessageId(sourceChainId());

        _setAsyncRequestSender(_messageId, msg.sender);

        emit UserRequestForInformation(_messageId, _requestSelector, msg.sender, _data);
        return _messageId;
    }

    /**
     * Tells if the specific async request selector is allowed to be used and supported by the bridge oracles.
     * @param _requestSelector selector for the async request.
     * @return true, if selector is allowed to be used.
     */
    function isAsyncRequestSelectorEnabled(bytes32 _requestSelector) public view returns (bool) {
        return boolStorage[keccak256(abi.encodePacked("enableRequestSelector", _requestSelector))];
    }

    /**
     * Enables or disables the specific async request selector.
     * Only owner can call this method.
     * @param _requestSelector selector for the async request.
     * @param _enable true, if the selector should be allowed.
     */
    function enableAsyncRequestSelector(bytes32 _requestSelector, bool _enable) external onlyOwner {
        boolStorage[keccak256(abi.encodePacked("enableRequestSelector", _requestSelector))] = _enable;

        emit EnabledAsyncRequestSelector(_requestSelector, _enable);
    }

    /**
     * @dev Submits result of the async call.
     * Only validators are allowed to call this method.
     * Once enough confirmations are collected, callback function is called.
     * @param _messageId unique id of the request that was previously made.
     * @param _status true, if JSON-RPC request succeeded, false otherwise.
     * @param _result call result returned by the other side of the bridge.
     */
    function confirmInformation(bytes32 _messageId, bool _status, bytes _result) external onlyValidator {
        bytes32 hashMsg = keccak256(abi.encodePacked(_messageId, _status, _result));
        bytes32 hashSender = keccak256(abi.encodePacked(msg.sender, hashMsg));
        // Duplicated confirmations
        require(!affirmationsSigned(hashSender));
        setAffirmationsSigned(hashSender, true);

        uint256 signed = numAffirmationsSigned(hashMsg);
        require(!isAlreadyProcessed(signed));
        // the check above assumes that the case when the value could be overflew will not happen in the addition operation below
        signed = signed + 1;

        setNumAffirmationsSigned(hashMsg, signed);

        emit SignedForInformation(msg.sender, _messageId);

        if (signed >= requiredSignatures()) {
            setNumAffirmationsSigned(hashMsg, markAsProcessed(signed));
            address sender = _restoreAsyncRequestSender(_messageId);
            bytes memory data = abi.encodeWithSelector(
                IAMBInformationReceiver(address(0)).onInformationReceived.selector,
                _messageId,
                _status,
                _result
            );
            uint256 gas = maxGasPerTx();
            require((gasleft() * 63) / 64 > gas);

            bool callbackStatus = sender.call.gas(gas)(data);

            emit InformationRetrieved(_messageId, _status, callbackStatus);
        }
    }

    /**
     * Internal function for saving async request sender for future use.
     * @param _messageId id of the sent async request.
     * @param _sender address of the request sender, receiver of the callback.
     */
    function _setAsyncRequestSender(bytes32 _messageId, address _sender) internal {
        addressStorage[keccak256(abi.encodePacked("asyncSender", _messageId))] = _sender;
    }

    /**
     * Internal function for restoring async request sender information.
     * @param _messageId id of the sent async request.
     * @return address of async request sender and callback receiver.
     */
    function _restoreAsyncRequestSender(bytes32 _messageId) internal returns (address) {
        bytes32 hash = keccak256(abi.encodePacked("asyncSender", _messageId));
        address sender = addressStorage[hash];

        require(sender != address(0));

        delete addressStorage[hash];
        return sender;
    }
}
