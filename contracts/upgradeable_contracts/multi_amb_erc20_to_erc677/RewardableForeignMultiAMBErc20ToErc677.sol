pragma solidity 0.4.24;

import "./ForeignMultiAMBErc20ToErc677.sol";
import "./FeeManagerMultiAMBErc20ToErc677.sol";
import "./MultiTokenForwardingRules.sol";

/**
 * @title ForeignMultiAMBErc20ToErc677
 * @dev Foreign side implementation for multi-erc20-to-erc677 mediator intended to work on top of AMB bridge.
 * It is designed to be used as an implementation contract of EternalStorageProxy contract.
 */
contract RewardableForeignMultiAMBErc20ToErc677 is
    ForeignMultiAMBErc20ToErc677,
    FeeManagerMultiAMBErc20ToErc677,
    MultiTokenForwardingRules
{
    /**
    * @dev Stores the initial parameters of the mediator.
    * @param _bridgeContract the address of the AMB bridge contract.
    * @param _mediatorContract the address of the mediator contract on the other network.
    * @param _dailyLimitMaxPerTxMinPerTxArray array with limit values for the assets to be bridged to the other network.
    *   [ 0 = dailyLimit, 1 = maxPerTx, 2 = minPerTx ]
    * @param _executionDailyLimitExecutionMaxPerTxArray array with limit values for the assets bridged from the other network.
    *   [ 0 = executionDailyLimit, 1 = executionMaxPerTx ]
    * @param _requestGasLimit the gas limit for the message execution.
    * @param _owner address of the owner of the mediator contract.
    * @param _rewardAddresses list of reward addresses, between whom fees will be distributed.
    * @param _fees array with initial fees for both bridge directions.
    *   [ 0 = homeToForeignFee, 1 = foreignToHomeFee ]
    */
    function initialize(
        address _bridgeContract,
        address _mediatorContract,
        uint256[3] _dailyLimitMaxPerTxMinPerTxArray, // [ 0 = _dailyLimit, 1 = _maxPerTx, 2 = _minPerTx ]
        uint256[2] _executionDailyLimitExecutionMaxPerTxArray, // [ 0 = _executionDailyLimit, 1 = _executionMaxPerTx ]
        uint256 _requestGasLimit,
        address _owner,
        address[] _rewardAddresses,
        uint256[2] _fees // [ 0 = homeToForeignFee, 1 = foreignToHomeFee ]
    ) public returns (bool) {
        if (_rewardAddresses.length > 0) {
            _setRewardAddressList(_rewardAddresses);
        }
        _setFee(HOME_TO_FOREIGN_FEE, address(0), _fees[0]);
        _setFee(FOREIGN_TO_HOME_FEE, address(0), _fees[1]);

        return
            super.initialize(
                _bridgeContract,
                _mediatorContract,
                _dailyLimitMaxPerTxMinPerTxArray,
                _executionDailyLimitExecutionMaxPerTxArray,
                _requestGasLimit,
                _owner
            );
    }

    /**
     * @dev Executes action on the request to withdraw tokens relayed from the other network
     * @param _token address of the token contract
     * @param _recipient address of tokens receiver
     * @param _value amount of bridged tokens
     */
    function executeActionOnBridgedTokens(address _token, address _recipient, uint256 _value) internal {
        bytes32 _messageId = messageId();
        uint256 valueToTransfer = _value;
        uint256 fee = _distributeFee(FOREIGN_TO_HOME_FEE, true, _token, valueToTransfer);
        if (fee > 0) {
            emit FeeDistributed(fee, _token, _messageId);
            valueToTransfer = valueToTransfer.sub(fee);
        }
        _setMediatorBalance(_token, mediatorBalance(_token).sub(_value));
        _token.safeTransfer(_recipient, _value);
        emit TokensBridged(_token, _recipient, valueToTransfer, _messageId);
    }

    /**
     * @dev Executes action on deposit of bridged tokens
     * @param _token address of the token contract
     * @param _from address of tokens sender
     * @param _receiver address of tokens receiver on the other side
     * @param _value requested amount of bridged tokens
     */
    function bridgeSpecificActionsOnTokenTransfer(ERC677 _token, address _from, address _receiver, uint256 _value)
        internal
    {
        bool isKnownToken = isTokenRegistered(_token);
        if (!isKnownToken) {
            string memory name = TokenReader.readName(_token);
            string memory symbol = TokenReader.readSymbol(_token);
            uint8 decimals = uint8(TokenReader.readDecimals(_token));

            require(bytes(name).length > 0 || bytes(symbol).length > 0);

            _initializeTokenBridgeLimits(_token, decimals);
            _setFee(HOME_TO_FOREIGN_FEE, _token, getFee(HOME_TO_FOREIGN_FEE, address(0)));
            _setFee(FOREIGN_TO_HOME_FEE, _token, getFee(FOREIGN_TO_HOME_FEE, address(0)));
        }

        require(withinLimit(_token, _value));
        addTotalSpentPerDay(_token, getCurrentDay(), _value);

        uint256 valueToBridge = _value;
        // Next line disables fee collection in case sender is one of the reward addresses.
        // It is needed to allow a 100% withdrawal of tokens from the home side.
        // If fees are not disabled for reward receivers, small fraction of tokens will always
        // be redistributed between the same set of reward addresses, which is not the desired behaviour.
        if (!isRewardAddress(_from)) {
            valueToBridge = valueToBridge.sub(_distributeFee(HOME_TO_FOREIGN_FEE, true, _token, _value));
        }

        bytes memory data;

        if (isKnownToken) {
            data = abi.encodeWithSelector(this.handleBridgedTokens.selector, _token, _receiver, valueToBridge);
        } else {
            data = abi.encodeWithSelector(
                HomeMultiAMBErc20ToErc677(this).deployAndHandleBridgedTokens.selector,
                _token,
                name,
                symbol,
                decimals,
                _receiver,
                valueToBridge
            );
        }

        _setMediatorBalance(_token, mediatorBalance(_token).add(_value));

        bytes32 _messageId = passMessage(_token, _from, _receiver, valueToBridge, data);
        if (valueToBridge < _value) {
            emit FeeDistributed(_value - valueToBridge, _token, _messageId);
        }
    }

    /**
    * @dev Call AMB bridge to require the invocation of handleBridgedTokens method of the mediator on the other network.
    * Store information related to the bridged tokens in case the message execution fails on the other network
    * and the action needs to be fixed/rolled back.
    * @param _token bridged ERC20 token
    * @param _from address of sender, if bridge operation fails, tokens will be returned to this address
    * @param _receiver address of receiver on the other side, will eventually receive bridged tokens
    * @param _value bridged amount of tokens
    * @param _data encoded message calldata to pass to the other side
    * @return id of the created and passed message
    */
    function passMessage(ERC677 _token, address _from, address _receiver, uint256 _value, bytes _data)
        internal
        returns (bytes32)
    {
        address executor = mediatorContractOnOtherSide();
        uint256 gasLimit = requestGasLimit();
        IAMB bridge = bridgeContract();

        // Address of the foreign token is used here for determining lane permissions.
        // Such decision makes it possible to set rules for tokens that are not bridged yet.
        bytes32 _messageId = destinationLane(_token, _from, _receiver) >= 0
            ? bridge.requireToPassMessage(executor, _data, gasLimit)
            : bridge.requireToConfirmMessage(executor, _data, gasLimit);

        setMessageToken(_messageId, _token);
        setMessageValue(_messageId, _value);
        setMessageRecipient(_messageId, _from);

        emit TokensBridgingInitiated(_token, _from, _value, _messageId);

        return _messageId;
    }
}
