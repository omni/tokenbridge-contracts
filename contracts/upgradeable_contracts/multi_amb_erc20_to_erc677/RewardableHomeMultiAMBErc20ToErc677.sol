pragma solidity 0.4.24;

import "./HomeMultiAMBErc20ToErc677.sol";
import "./FeeManagerMultiAMBErc20ToErc677.sol";
import "./MultiTokenForwardingRules.sol";

/**
* @title RewardableHomeMultiAMBErc20ToErc677
* @dev Home side implementation for multi-erc20-to-erc677 mediator intended to work on top of AMB bridge.
* Intended to be used in pair with HomeAMB contract. Supports fee collection. Supports manual lanes when passing a message.
* It is designed to be used as an implementation contract of EternalStorageProxy contract.
*/
contract RewardableHomeMultiAMBErc20ToErc677 is
    HomeMultiAMBErc20ToErc677,
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
    * @param _tokenImage address of the PermittableToken contract that will be used for deploying of new tokens.
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
        address _tokenImage,
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
                _owner,
                _tokenImage
            );
    }

    /**
    * @dev Handles the bridged tokens for the first time, includes deployment of new TokenProxy contract.
    * Checks that the value is inside the execution limits and invokes the method
    * to execute the Mint or Unlock accordingly.
    * @param _token address of the bridged ERC20/ERC677 token on the foreign side.
    * @param _name name of the bridged token, " on xDai" will be appended, if empty, symbol will be used instead.
    * @param _symbol symbol of the bridged token, if empty, name will be used instead.
    * @param _decimals decimals of the bridge foreign token.
    * @param _recipient address that will receive the tokens.
    * @param _value amount of tokens to be received.
    */
    function deployAndHandleBridgedTokens(
        address _token,
        string _name,
        string _symbol,
        uint8 _decimals,
        address _recipient,
        uint256 _value
    ) external onlyMediator {
        string memory name = _name;
        string memory symbol = _symbol;
        require(bytes(name).length > 0 || bytes(symbol).length > 0);
        if (bytes(name).length == 0) {
            name = symbol;
        } else if (bytes(symbol).length == 0) {
            symbol = name;
        }
        name = string(abi.encodePacked(name, " on xDai"));
        address homeToken = new TokenProxy(tokenImage(), name, symbol, _decimals, bridgeContract().sourceChainId());
        _setTokenAddressPair(_token, homeToken);
        _initializeTokenBridgeLimits(homeToken, _decimals);
        _setFee(HOME_TO_FOREIGN_FEE, homeToken, getFee(HOME_TO_FOREIGN_FEE, address(0)));
        _setFee(FOREIGN_TO_HOME_FEE, homeToken, getFee(FOREIGN_TO_HOME_FEE, address(0)));
        _handleBridgedTokens(ERC677(homeToken), _recipient, _value);

        emit NewTokenRegistered(_token, homeToken);
    }

    /**
     * @dev Executes action on the request to deposit tokens relayed from the other network
     * @param _recipient address of tokens receiver
     * @param _value amount of bridged tokens
     */
    function executeActionOnBridgedTokens(address _token, address _recipient, uint256 _value) internal {
        bytes32 _messageId = messageId();
        uint256 valueToMint = _value;
        uint256 fee = _distributeFee(FOREIGN_TO_HOME_FEE, false, _token, valueToMint);
        if (fee > 0) {
            emit FeeDistributed(fee, _token, _messageId);
            valueToMint = valueToMint.sub(fee);
        }
        IBurnableMintableERC677Token(_token).mint(_recipient, valueToMint);
        emit TokensBridged(_token, _recipient, valueToMint, _messageId);
    }

    /**
     * @dev Executes action on withdrawal of bridged tokens
     * @param _token address of token contract
     * @param _from address of tokens sender
     * @param _receiver address of tokens receiver on the other side
     * @param _value requested amount of bridged tokens
     */
    function bridgeSpecificActionsOnTokenTransfer(ERC677 _token, address _from, address _receiver, uint256 _value)
        internal
    {
        uint256 valueToBridge = _value;
        uint256 fee = 0;
        // Next line disables fee collection in case sender is one of the reward addresses.
        // It is needed to allow a 100% withdrawal of tokens from the home side.
        // If fees are not disabled for reward receivers, small fraction of tokens will always
        // be redistributed between the same set of reward addresses, which is not the desired behaviour.
        if (!isRewardAddress(_from)) {
            fee = _distributeFee(HOME_TO_FOREIGN_FEE, true, _token, valueToBridge);
            valueToBridge = valueToBridge.sub(fee);
        }
        IBurnableMintableERC677Token(_token).burn(valueToBridge);
        bytes32 _messageId = passMessage(_token, _from, _receiver, valueToBridge);
        if (fee > 0) {
            emit FeeDistributed(fee, _token, _messageId);
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
    * @return id of the created and passed message
    */
    function passMessage(ERC677 _token, address _from, address _receiver, uint256 _value) internal returns (bytes32) {
        bytes4 methodSelector = this.handleBridgedTokens.selector;
        address foreignToken = foreignTokenAddress(_token);
        bytes memory data = abi.encodeWithSelector(methodSelector, foreignToken, _receiver, _value);

        address executor = mediatorContractOnOtherSide();
        uint256 gasLimit = requestGasLimit();
        IAMB bridge = bridgeContract();

        // Address of the foreign token is used here for determining lane permissions.
        // Such decision makes it possible to set rules for tokens that are not bridged yet.
        bytes32 _messageId = destinationLane(foreignToken, _from, _receiver) >= 0
            ? bridge.requireToPassMessage(executor, data, gasLimit)
            : bridge.requireToConfirmMessage(executor, data, gasLimit);

        setMessageToken(_messageId, _token);
        setMessageValue(_messageId, _value);
        setMessageRecipient(_messageId, _from);

        emit TokensBridgingInitiated(_token, _from, _value, _messageId);

        return _messageId;
    }
}
