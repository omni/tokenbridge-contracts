pragma solidity 0.4.24;

import "./ForeignAMB.sol";
import "../POSValidatorSet.sol";

/**
 * @title OptimisticForeignAMB
 * @dev Extension of the ForeignAMB contract to support optimistic execution.
 */
contract OptimisticForeignAMB is ForeignAMB {
    uint256 internal constant REJECTED_FLAG = 0x8000000000000000000000000000000000000000000000000000000000000000;
    uint256 internal constant REJECTS_COUNT_MASK = 0x7fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff;
    bytes32 internal constant POS_VALIDATOR_SET_CONTRACT = 0xfdd162c21c0ec6e658c4a59ce7e015a47f56893c317040b92bfc098e831b722f; // keccak256(abi.encodePacked("posValidatorSetContract"))
    bytes32 internal constant OPTIMISTIC_MESSAGE_MINIMAL_BOND = 0x6511fa6e24b050e0e8f41b3d7892702e0c9252d5f1c097c4661ec6e8be1ee112; // keccak256(abi.encodePacked("optimisticMessageMinimalBond"))
    bytes32 internal constant OPTIMISTIC_MESSAGE_REJECTS_COUNT = 0x14283c139155f1b64b13c7c6ef8ed35d4aac516b4c3820fab9bddbed9cb2b78f; // keccak256(abi.encodePacked("optimisticMessageRejectsCount"))
    bytes32 internal constant OPTIMISTIC_MESSAGE_REJECTS_PARTY = 0x77403f01d8849b1d7c2511dee9f0e1f86ca6801f39faf8286f24991cd1610341; // keccak256(abi.encodePacked("optimisticMessageRejectsParty")
    bytes32 internal constant OPTIMISTIC_MESSAGE_SENDER = 0x4e7350b3196025f6813c806b1ba9f24ea96d7bb5a09be4ffbb2ba0d5e5d632e2; // keccak256(abi.encodePacked("optimisticMessageSender")
    bytes32 internal constant OPTIMISTIC_MESSAGE_BOND = 0xd69a99fe9ee63cf1ff8db4bedebb88e0b846a691ccb4c1357136cef0f4b21eb1; // keccak256(abi.encodePacked("optimisticMessageBond")
    bytes32 internal constant OPTIMISTIC_MESSAGE_SUBMIT_TIME = 0x4982c9cb2078c338544ac9b17e5e87d3e4f00b0cf37676a818a996d83e30af3c; // keccak256(abi.encodePacked("optimisticMessageSubmitTime")
    bytes32 internal constant OPTIMISTIC_MESSAGE_DATA = 0x66449fec616b5ba4c7d509f99941198854ab27c2ae2f55745572d7641b066f65; // keccak256(abi.encodePacked("optimisticMessageData")
    bytes32 internal constant OPTIMISTIC_BRIDGE_SHUTDOWNED = 0xd90666c2303f5261a389b5dc55b0f57b2855f0de1c899587897aa2db7ff22e53; // keccak256(abi.encodePacked("optimisticBridgeShutdowned")

    event OptimisticMessageSubmitted(bytes32 indexed messageId, bytes32 messageHash, uint256 executionTime);
    event OptimisticMessageRejectSubmitted(bytes32 indexed messageId, address validator);
    event OptimisticMessageRejected(bytes32 indexed messageId, uint256 rejectsCollected);
    event OptimisticMessageRewardClaimed(address indexed validator, bytes32[] messageIds, uint256 reward);
    event OptimisticMessageExecuted(bytes32 indexed messageId);
    event ValidatorSetContractUpdated(address indexed contractAddress);
    event MinimalBondForOptimisticExecutionUpdated(uint256 bond);
    event OptimisticBridgeShutdowned(bool isShutdowned);

    /**
    * @dev Throws if an optimistic execution is temporarly disabled.
    */
    modifier optimisticBridgeEnabled() {
        require(isOptimisticBridgeEnabled());
        /* solcov ignore next */
        _;
    }

    /**
     * Initializes Opitmistic AMB contract.
     * @param _sourceChainId chain id of a network where this contract is deployed.
     * @param _destinationChainId chain id of a network where all outgoing messages are directed.
     * @param _validatorContract address of the validators contract.
     * @param _maxGasPerTx maximum amount of gas per one message execution.
     * @param _gasPrice default gas price used by oracles for sending transactions in this network.
     * @param _requiredBlockConfirmations number of block confirmations oracle will wait before processing passed messages.
     * @param _owner address of new bridge owner.
     * @param _posValidatorSetContract address of the POSValidatorSet contract.
     * @param _minimalBondForOptimisticExecution minimal required bond for optimistic execution.
     */
    function initialize(
        uint256 _sourceChainId,
        uint256 _destinationChainId,
        address _validatorContract,
        uint256 _maxGasPerTx,
        uint256 _gasPrice,
        uint256 _requiredBlockConfirmations,
        address _owner,
        address _posValidatorSetContract,
        uint256 _minimalBondForOptimisticExecution
    ) external returns (bool) {
        _setPosValidatorSetContract(_posValidatorSetContract);
        _setMinimalBondForOptimisticExecution(_minimalBondForOptimisticExecution);

        return
            super.initialize(
                _sourceChainId,
                _destinationChainId,
                _validatorContract,
                _maxGasPerTx,
                _gasPrice,
                _requiredBlockConfirmations,
                _owner
            );
    }

    /**
     * @dev Submits a new message for further optimistic execution.
     * It is important that submitter data is equal to the one used to obtain the _messageId on the other side of the bridge.
     * @param _data message data that will be used during the later execution.
     */
    function requestToExecuteMessage(bytes _data) public payable optimisticBridgeEnabled {
        (bytes32 messageId, , , , , uint256[2] memory chainIds, , ) = ArbitraryMessage.unpackData(_data);

        require(_isMessageVersionValid(messageId));
        require(_isDestinationChainIdValid(chainIds[1]));
        require(!relayedMessages(messageId));

        require(msg.value >= minimalBondForOptimisticExecution());

        _setOptimisticMessageData(messageId, _data);

        emit OptimisticMessageSubmitted(messageId, keccak256(_data), optimisticMesssageExecutionTime(messageId));
    }

    /**
     * @dev Tries to update a validator set as a part of this transaction. Then proceeds with the requestToExecuteMessage call.
     * @param _data message data that will be used during the later execution.
     * @param _validatorsRoot new value of the new validator set root.
     * @param _requiredSignatures new minimum number of required signatures/rejects.
     * @param _expireTime new timestamp when a given validators merkle root will expire.
     * @param _signatures blob containing some of the validators signatures and the remaining addresses.
     */
    function requestToExecuteMessageWithValidatorSet(
        bytes _data,
        bytes32 _validatorsRoot,
        uint256 _requiredSignatures,
        uint256 _expireTime,
        bytes _signatures
    ) external payable optimisticBridgeEnabled {
        posValidatorSetContract().updateValidatorSet(_validatorsRoot, _requiredSignatures, _expireTime, _signatures);
        requestToExecuteMessage(_data);
    }

    /**
     * @dev Executes a previously saved optimistic message.
     * Does nothing, if the message was already processed by the bridge validators.
     * @param _messageId id of the message to execute.
     */
    function executeMessage(bytes32 _messageId) external optimisticBridgeEnabled {
        require(_isMessageVersionValid(_messageId));

        require(now >= optimisticMesssageExecutionTime(_messageId));
        require(optimisticMessageRejectsCount(_messageId) < posValidatorSetContract().requiredSignatures());
        address optimisticSender = optimisticMessageSender(_messageId);
        uint256 bond = optimisticMessageBond(_messageId);
        require(bond > 0);
        bytes memory data = optimisticMessageData(_messageId);

        _deleteOptimisticMessage(_messageId);

        optimisticSender.transfer(bond);

        // if message was already executed by bridge validators, nothing will be done, bond will be returned to the optimistic message sender
        if (!relayedMessages(_messageId)) {
            (, address sender, address executor, uint32 gasLimit, bytes1 dataType, uint256[2] memory chainIds, uint256 gasPrice, bytes memory payload) = ArbitraryMessage
                .unpackData(data);
            setRelayedMessages(_messageId, true);
            processMessage(sender, executor, _messageId, gasLimit, dataType, gasPrice, chainIds[0], payload);

            emit OptimisticMessageExecuted(_messageId);
        }
    }

    /**
     * @dev Submits a reject for one existing optimistic message.
     * Message can be rejected only by the current POS validators.
     * @param _messageId id of the message obtained on the other side of the bridge.
     * @param _merkleProof merkle tree proof that confirmes that transaction sender is indeed a validator.
     */
    function rejectOptimisticMessage(bytes32 _messageId, bytes32[] _merkleProof) external optimisticBridgeEnabled {
        require(now < optimisticMesssageExecutionTime(_messageId));
        POSValidatorSet validatorSetContract = posValidatorSetContract();
        require(validatorSetContract.isPOSValidator(msg.sender, _merkleProof));

        bytes32 countKey = keccak256(abi.encodePacked(OPTIMISTIC_MESSAGE_REJECTS_COUNT, _messageId));
        uint256 count = uintStorage[countKey];
        require(count < REJECTED_FLAG);
        bytes32 partyKey = keccak256(abi.encodePacked(OPTIMISTIC_MESSAGE_REJECTS_PARTY, _messageId, msg.sender));
        require(!boolStorage[partyKey]);
        boolStorage[partyKey] = true;
        count += 1;
        if (count >= validatorSetContract.requiredSignatures()) {
            uintStorage[countKey] = count | REJECTED_FLAG;
            emit OptimisticMessageRejected(_messageId, count);
        } else {
            uintStorage[countKey] = count;
        }

        emit OptimisticMessageRejectSubmitted(_messageId, msg.sender);
    }

    /**
     * @dev Submits a reject for a batch of existing optimistic messages.
     * Messages can be rejected only by the current POS validators.
     * @param _messageIds ids of the messages obtained on the other side of the bridge.
     * @param _merkleProof merkle tree proof that confirmes that transaction sender is indeed a validator.
     */
    function rejectOptimisticMessageBatch(bytes32[] _messageIds, bytes32[] _merkleProof)
        external
        optimisticBridgeEnabled
    {
        POSValidatorSet validatorSetContract = posValidatorSetContract();
        require(validatorSetContract.isPOSValidator(msg.sender, _merkleProof));

        uint256 requiredSignatures = validatorSetContract.requiredSignatures();
        for (uint256 i = 0; i < _messageIds.length; i++) {
            bytes32 messageId = _messageIds[i];
            require(now < optimisticMesssageExecutionTime(messageId));

            bytes32 countKey = keccak256(abi.encodePacked(OPTIMISTIC_MESSAGE_REJECTS_COUNT, messageId));
            uint256 count = uintStorage[countKey];
            if (count < REJECTED_FLAG) {
                bytes32 partyKey = keccak256(abi.encodePacked(OPTIMISTIC_MESSAGE_REJECTS_PARTY, messageId, msg.sender));
                require(!boolStorage[partyKey]);
                boolStorage[partyKey] = true;
                count += 1;
                if (count >= requiredSignatures) {
                    uintStorage[countKey] = count | REJECTED_FLAG;
                    emit OptimisticMessageRejected(messageId, count);
                } else {
                    uintStorage[countKey] = count;
                }
            }

            emit OptimisticMessageRejectSubmitted(messageId, msg.sender);
        }
    }

    /**
     * @dev Claims a part of the reward for one particular rejected optimitic message.
     * @param _messageId id of the message obtained on the other side of the bridge that was already rejected by POS validators.
     */
    function claimReward(bytes32 _messageId) external optimisticBridgeEnabled {
        bytes32[] memory messageIds = new bytes32[](1);
        messageIds[0] = _messageId;
        claimRewardBatch(messageIds);
    }

    /**
     * @dev Claims a part of the reward for a batch of rejected optimitic messages.
     * @param _messageIds ids of the messages obtained on the other side of the bridge, that were already rejected by POS validators.
     */
    function claimRewardBatch(bytes32[] _messageIds) public optimisticBridgeEnabled {
        uint256 reward = 0;
        for (uint256 i = 0; i < _messageIds.length; i++) {
            bytes32 messageId = _messageIds[i];

            bytes32 partyKey = keccak256(abi.encodePacked(OPTIMISTIC_MESSAGE_REJECTS_PARTY, messageId, msg.sender));
            uint256 count = uintStorage[keccak256(abi.encodePacked(OPTIMISTIC_MESSAGE_REJECTS_COUNT, messageId))];
            require(count > REJECTED_FLAG);
            require(boolStorage[partyKey]);
            delete boolStorage[partyKey];

            uint256 bond = optimisticMessageBond(messageId);

            reward += bond / (count - REJECTED_FLAG);
        }
        msg.sender.transfer(reward);

        emit OptimisticMessageRewardClaimed(msg.sender, _messageIds, reward);
    }

    /**
     * @dev Suspends or resumes all optimistic bridge operations in case of emergency.
     * @param _isShutdowned boolean flag for stopping/resuming optimistic bridge.
     */
    function emergencyShutdownOptimisticBridge(bool _isShutdowned) external onlyOwner {
        boolStorage[OPTIMISTIC_BRIDGE_SHUTDOWNED] = _isShutdowned;

        emit OptimisticBridgeShutdowned(_isShutdowned);
    }

    /**
     * @dev Checks if optimistic bridge is enabled and currently operating.
     * @return true, if bridge is active.
     */
    function isOptimisticBridgeEnabled() public view returns (bool) {
        return !boolStorage[OPTIMISTIC_BRIDGE_SHUTDOWNED];
    }

    /**
     * @dev Retrieves the number of collected rejects for some optimistic message.
     * @param _messageId id of the message obtained on the other side of the bridge.
     * @return address of the contract.
     */
    function optimisticMessageRejectsCount(bytes32 _messageId) public view returns (uint256) {
        return
            uintStorage[keccak256(abi.encodePacked(OPTIMISTIC_MESSAGE_REJECTS_COUNT, _messageId))] & REJECTS_COUNT_MASK;
    }

    /**
     * @dev Retrieves the approximate execution time for the submitted optimistic message.
     * @param _messageId id of the message obtained on the other side of the bridge.
     * @return approximate execution time.
     */
    function optimisticMesssageExecutionTime(bytes32 _messageId) public view returns (uint256) {
        uint256 submitTime = optimisticMessageSubmissionTime(_messageId);
        uint256 rejects = optimisticMessageRejectsCount(_messageId);
        uint256 validatorSetExpirationTime = posValidatorSetContract().expirationTime();
        uint256 delay = 24 hours + rejects * rejects * 12 hours;
        if (submitTime > validatorSetExpirationTime) {
            delay += submitTime - validatorSetExpirationTime;
        }
        return submitTime + (delay > 4 weeks ? 4 weeks : delay);
    }

    /**
     * @dev Retrieves the time when some optimistic message was submitted.
     * @param _messageId id of the message obtained on the other side of the bridge.
     * @return time of submission.
     */
    function optimisticMessageSubmissionTime(bytes32 _messageId) public view returns (uint256) {
        return uintStorage[keccak256(abi.encodePacked(OPTIMISTIC_MESSAGE_SUBMIT_TIME, _messageId))];
    }

    /**
     * @dev Retrieves the bond value that was locked during the optimistic message submission.
     * @param _messageId id of the message obtained on the other side of the bridge.
     * @return locked amount of coins.
     */
    function optimisticMessageBond(bytes32 _messageId) public view returns (uint256) {
        return uintStorage[keccak256(abi.encodePacked(OPTIMISTIC_MESSAGE_BOND, _messageId))];
    }

    /**
     * @dev Retrieves address of optimistic message submitter.
     * @param _messageId id of the message obtained on the other side of the bridge.
     * @return address of the optimistic message submitter.
     */
    function optimisticMessageSender(bytes32 _messageId) public view returns (address) {
        return addressStorage[keccak256(abi.encodePacked(OPTIMISTIC_MESSAGE_SENDER, _messageId))];
    }

    /**
     * @dev Retrieves the data associated with the the submitted optimistic message.
     * @param _messageId id of the message obtained on the other side of the bridge.
     * @return optimistic message data.
     */
    function optimisticMessageData(bytes32 _messageId) public view returns (bytes) {
        return bytesStorage[keccak256(abi.encodePacked(OPTIMISTIC_MESSAGE_DATA, _messageId))];
    }

    /**
     * @dev Retrieves the POSValidatorSet contract address.
     * @return address of the contract.
     */
    function posValidatorSetContract() public view returns (POSValidatorSet) {
        return POSValidatorSet(addressStorage[POS_VALIDATOR_SET_CONTRACT]);
    }

    /**
     * @dev Updates the stored address of the POSValidatorSet contract.
     * Can be called only by the owner of this contract.
     * @param _contract address of the new contract.
     */
    function setPosValidatorSetContract(address _contract) external onlyOwner {
        _setPosValidatorSetContract(_contract);
    }

    /**
     * @dev Retrieves the minimal required bond value for optimistic execution.
     * @return value of minimal required bond.
     */
    function minimalBondForOptimisticExecution() public view returns (uint256) {
        return uintStorage[OPTIMISTIC_MESSAGE_MINIMAL_BOND];
    }

    /**
     * @dev Updates the stored value of the minimal required bond for optimistic execution.
     * Can be called only by the owner of this contract.
     * @param _bond new value of minimal required bond.
     */
    function setMinimalBondForOptimisticExecution(uint256 _bond) external onlyOwner {
        _setMinimalBondForOptimisticExecution(_bond);
    }

    /**
     * @dev Internal function for updating stored address of the POSValidatorSet contract.
     * @param _contract address of the new contract.
     */
    function _setPosValidatorSetContract(address _contract) internal {
        require(AddressUtils.isContract(_contract));
        addressStorage[POS_VALIDATOR_SET_CONTRACT] = _contract;

        emit ValidatorSetContractUpdated(_contract);
    }

    /**
     * @dev Internal function for updating minimal bond required for optimistic execution.
     * @param _bond new value of minimal required bond.
     */
    function _setMinimalBondForOptimisticExecution(uint256 _bond) internal {
        uintStorage[OPTIMISTIC_MESSAGE_MINIMAL_BOND] = _bond;

        emit MinimalBondForOptimisticExecutionUpdated(_bond);
    }

    /**
     * @dev Internal function for setting new optimistic message data.
     * @param _messageId id of the message obtained on the other side of the bridge.
     * @param _data message payload.
     */
    function _setOptimisticMessageData(bytes32 _messageId, bytes _data) internal {
        addressStorage[keccak256(abi.encodePacked(OPTIMISTIC_MESSAGE_SENDER, _messageId))] = msg.sender;
        uintStorage[keccak256(abi.encodePacked(OPTIMISTIC_MESSAGE_BOND, _messageId))] = msg.value;
        uintStorage[keccak256(abi.encodePacked(OPTIMISTIC_MESSAGE_SUBMIT_TIME, _messageId))] = now;
        bytesStorage[keccak256(abi.encodePacked(OPTIMISTIC_MESSAGE_DATA, _messageId))] = _data;
    }

    /**
     * @dev Internal function for clearing the storage optimistic message execution.
     * @param _messageId id of the message obtained on the other side of the bridge.
     */
    function _deleteOptimisticMessage(bytes32 _messageId) internal {
        delete addressStorage[keccak256(abi.encodePacked(OPTIMISTIC_MESSAGE_SENDER, _messageId))];
        delete uintStorage[keccak256(abi.encodePacked(OPTIMISTIC_MESSAGE_BOND, _messageId))];
        delete uintStorage[keccak256(abi.encodePacked(OPTIMISTIC_MESSAGE_SUBMIT_TIME, _messageId))];
        delete bytesStorage[keccak256(abi.encodePacked(OPTIMISTIC_MESSAGE_DATA, _messageId))];
    }
}
