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
        address indexed sender,
        address indexed executor,
        bytes data,
        uint256 timestamp,
        address from,
        uint256 gas
    );
    event SignedForInformation(address indexed signer, bytes32 indexed messageId);
    event InformationRetrieved(
        bytes32 indexed messageId,
        address indexed sender,
        address indexed executor,
        bool status,
        bool callbackStatus
    );

    /**
     * @dev Makes an asynchronous request to get information from the opposite network.
     * Call result will be returned later to the callee, by using the onInformationReceived(bytes) callback function.
     * @param _contract executor address on the other side.
     * @param _data calldata passed to the executor on the other side.
     * @param _gas gas limit used on the other network for making eth_call.
     * @param _from address on the other side to use in a from param of eth_call.
     */
    function requireToGetInformation(address _contract, bytes _data, uint256 _gas, address _from)
        external
        returns (bytes32)
    {
        // it is not allowed to pass messages while other messages are processed
        require(messageId() == bytes32(0));
        // only contracts are allowed to call this method, since EOA won't be able to receive a callback.
        require(AddressUtils.isContract(msg.sender));

        require(_gas >= 21000 + getMinimumGasUsage(_data) && _gas <= 10000000);

        bytes32 _messageId = _getNewMessageId(sourceChainId());

        _saveAsyncRequestInformation(_messageId, msg.sender, _contract);

        emit UserRequestForInformation(_messageId, msg.sender, _contract, _data, now, _from, _gas);
        return _messageId;
    }

    /**
     * @dev Submits async eth_call result on behalf of bridge validator.
     * Only validators are allowed to call this method.
     * Once enough confirmations are collected, callback function is called.
     * @param _messageId unique id of the request that was previously made.
     * @param _status true, if eth_call succeeded, false otherwise.
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
            (address sender, address executor) = _restoreAsyncRequestInformation(_messageId);
            bytes memory data = abi.encodeWithSelector(
                IAMBInformationReceiver(address(0)).onInformationReceived.selector,
                _messageId,
                _status,
                _result
            );
            uint256 gas = maxGasPerTx();
            require((gasleft() * 63) / 64 > gas);

            bool callbackStatus = sender.call.gas(gas)(data);

            emit InformationRetrieved(_messageId, sender, executor, _status, callbackStatus);
        }
    }

    /**
     * Internal function for saving callback information for future use.
     * @param _messageId id of the sent async request.
     * @param _sender address of the request sender, receiver of the callback.
     * @param _executor address of the executor on the other side.
     */
    function _saveAsyncRequestInformation(bytes32 _messageId, address _sender, address _executor) internal {
        addressStorage[keccak256(abi.encodePacked("asyncSender", _messageId))] = _sender;
        addressStorage[keccak256(abi.encodePacked("asyncExecutor", _messageId))] = _executor;
    }

    /**
     * Internal function for restoring callback information that was saved previously.
     * @param _messageId id of the sent async request.
     * @return addresses of async request sender, async request executor.
     */
    function _restoreAsyncRequestInformation(bytes32 _messageId) internal returns (address, address) {
        bytes32 hash1 = keccak256(abi.encodePacked("asyncSender", _messageId));
        bytes32 hash2 = keccak256(abi.encodePacked("asyncExecutor", _messageId));
        address sender = addressStorage[hash1];
        address executor = addressStorage[hash2];

        require(sender != address(0) && executor != address(0));

        delete addressStorage[hash1];
        delete addressStorage[hash2];
        return (sender, executor);
    }
}
