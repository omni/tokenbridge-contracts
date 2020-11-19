pragma solidity 0.4.24;

import "../Initializable.sol";
import "../Upgradeable.sol";
import "../Claimable.sol";
import "../VersionableBridge.sol";
import "./MultiTokenBridgeMediator.sol";
import "./MultiTokenBridgedRegistry.sol";
import "./MultiTokenNativeRegistry.sol";
import "./MultiTokenRelayer.sol";
import "./modules/factory/TokenFactoryConnector.sol";
import "../../interfaces/IBurnableMintableERC677Token.sol";
import "../../libraries/TokenReader.sol";

/**
* @title BasicMultiAMBErc20ToErc677
* @dev Common functionality for universal multi-erc20-to-erc677 mediator intended to work on top of AMB bridge.
*/
contract BasicMultiAMBErc20ToErc677 is
    Initializable,
    Upgradeable,
    Claimable,
    VersionableBridge,
    MultiTokenBridgeMediator,
    MultiTokenBridgedRegistry,
    MultiTokenNativeRegistry,
    MultiTokenRelayer,
    TokenFactoryConnector
{
    using SafeERC20 for ERC677;

    /**
    * @dev Handles the bridged tokens for the first time, includes deployment of new TokenProxy contract.
    * Checks that the value is inside the execution limits and invokes the Mint or Unlock accordingly.
    * @param _token address of the native ERC20/ERC677 token on the other side.
    * @param _name name of the native token, name suffix will be appended, if empty, symbol will be used instead.
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
        address homeToken = _createBridgedToken(_token, _name, _symbol, _decimals);

        _handleTokens(homeToken, false, _recipient, _value);
    }

    /**
    * @dev Handles the bridged tokens for the already registered token pair.
    * Checks that the value is inside the execution limits and invokes the Mint or Unlock accordingly.
    * @param _token address of the native ERC20/ERC677 token on the other side.
    * @param _recipient address that will receive the tokens.
    * @param _value amount of tokens to be received.
    */
    function handleBridgedTokens(address _token, address _recipient, uint256 _value) external onlyMediator {
        address token = bridgedTokenAddress(_token);

        require(isTokenRegistered(token));

        _handleTokens(token, false, _recipient, _value);
    }

    /**
    * @dev Handles the bridged tokens that are native to this chain.
    * Checks that the value is inside the execution limits and invokes the Mint or Unlock accordingly.
    * @param _token native ERC20 token.
    * @param _recipient address that will receive the tokens.
    * @param _value amount of tokens to be received.
    */
    function handleNativeTokens(address _token, address _recipient, uint256 _value) external onlyMediator {
        require(isTokenRegistered(_token));

        _handleTokens(_token, true, _recipient, _value);
    }

    /**
    * @dev Handles the bridged tokens.
    * Checks that the value is inside the execution limits and invokes the Mint or Unlock accordingly.
    * @param _token token contract address on this side of the bridge.
    * @param _isNative true, if given token is native to this chain and Unlock should be used.
    * @param _recipient address that will receive the tokens.
    * @param _value amount of tokens to be received.
    */
    function _handleTokens(address _token, bool _isNative, address _recipient, uint256 _value) internal {
        require(withinExecutionLimit(_token, _value));
        addTotalExecutedPerDay(_token, getCurrentDay(), _value);

        if (_isNative) {
            _token.safeTransfer(_recipient, _value);
            _setMediatorBalance(_token, mediatorBalance(_token).sub(_value));
        } else {
            IBurnableMintableERC677Token(_token).mint(_recipient, _value);
        }

        emit TokensBridged(_token, _recipient, _value, messageId());
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
        uint8 decimals;
        bool isKnownToken = isTokenRegistered(_token);
        bool isNativeToken = isRegisteredAsNativeToken(_token);

        // native unbridged token
        if (!isKnownToken) {
            decimals = uint8(TokenReader.readDecimals(_token));
            _initToken(_token, decimals);
        }

        require(withinLimit(_token, _value));
        addTotalSpentPerDay(_token, getCurrentDay(), _value);

        bytes memory data = _prepareMessage(isKnownToken, isNativeToken, _token, _receiver, _value, decimals);
        bytes32 _messageId = _passMessage(data, _token, _from, _receiver);
        _recordBridgeOperation(!isKnownToken, _messageId, _token, _from, _value);
    }

    /**
    * @dev Unlock back the amount of tokens that were bridged to the other network but failed.
    * @param _messageId id of the failed message.
    * @param _token address that bridged token contract.
    * @param _recipient address that will receive the tokens.
    * @param _value amount of tokens to be received.
    */
    function executeActionOnFixedTokens(bytes32 _messageId, address _token, address _recipient, uint256 _value)
        internal
    {
        bytes32 registrationMessageId = tokenRegistrationMessageId(_token);
        if (registrationMessageId != bytes32(0)) {
            _token.safeTransfer(_recipient, _value);
            _setMediatorBalance(_token, mediatorBalance(_token).sub(_value));
            if (_messageId == registrationMessageId) {
                delete uintStorage[keccak256(abi.encodePacked("dailyLimit", _token))];
                delete uintStorage[keccak256(abi.encodePacked("maxPerTx", _token))];
                delete uintStorage[keccak256(abi.encodePacked("minPerTx", _token))];
                delete uintStorage[keccak256(abi.encodePacked("executionDailyLimit", _token))];
                delete uintStorage[keccak256(abi.encodePacked("executionMaxPerTx", _token))];
                _setTokenRegistrationMessageId(_token, bytes32(0));
            }
        } else {
            IBurnableMintableERC677Token(_token).mint(_recipient, _value);
        }
    }

    /**
     * @dev Allows to send to the other network the amount of locked tokens that can be forced into the contract
     * without the invocation of the required methods. (e. g. regular transfer without a call to onTokenTransfer)
     * @param _token address of the token contract.
     * @param _receiver the address that will receive the tokens on the other network.
     */
    function fixMediatorBalance(address _token, address _receiver)
        external
        onlyIfUpgradeabilityOwner
        validAddress(_receiver)
    {
        require(isRegisteredAsNativeToken(_token));
        uint256 balance = ERC677(_token).balanceOf(address(this));
        uint256 expectedBalance = mediatorBalance(_token);
        require(balance > expectedBalance);
        uint256 diff = balance - expectedBalance;
        uint256 available = maxAvailablePerTx(_token);
        require(available > 0);
        if (diff > available) {
            diff = available;
        }
        addTotalSpentPerDay(_token, getCurrentDay(), diff);

        bytes memory data = _prepareMessage(true, true, _token, _receiver, diff, 0);

        bytes32 _messageId = _passMessage(data, _token, _receiver, _receiver);
        _recordBridgeOperation(false, _messageId, _token, _receiver, diff);
    }

    /**
    * @dev Tells the bridge interface version that this contract supports.
    * @return major value of the version
    * @return minor value of the version
    * @return patch value of the version
    */
    function getBridgeInterfacesVersion() external pure returns (uint64 major, uint64 minor, uint64 patch) {
        return (2, 0, 0);
    }

    /**
    * @dev Tells the bridge mode that this contract supports.
    * @return _data 4 bytes representing the bridge mode
    */
    function getBridgeMode() external pure returns (bytes4 _data) {
        return 0xb1516c26; // bytes4(keccak256(abi.encodePacked("multi-erc-to-erc-amb")))
    }

    /**
    * @dev Claims stucked tokens. Only unsupported tokens can be claimed.
    * When dealing with already supported tokens, fixMediatorBalance can be used instead.
    * @param _token address of claimed token, address(0) for native
    * @param _to address of tokens receiver
    */
    function claimTokens(address _token, address _to) external onlyIfUpgradeabilityOwner {
        // Only unregistered tokens and native coins are allowed to be claimed with the use of this function
        require(_token == address(0) || !isTokenRegistered(_token));
        claimValues(_token, _to);
    }

    /**
     * @dev Tells the expected token balance of the contract.
     * @param _token address of token contract.
     * @return the current tracked token balance of the contract.
     */
    function mediatorBalance(address _token) public view returns (uint256) {
        return uintStorage[keccak256(abi.encodePacked("mediatorBalance", _token))];
    }

    /**
     * @dev Updates expected token balance of the contract.
     * @param _token address of token contract.
     * @param _balance the new token balance of the contract.
     */
    function _setMediatorBalance(address _token, uint256 _balance) internal {
        uintStorage[keccak256(abi.encodePacked("mediatorBalance", _token))] = _balance;
    }

    function _passMessage(bytes _data, address, address, address) internal returns (bytes32) {
        return bridgeContract().requireToPassMessage(mediatorContractOnOtherSide(), _data, requestGasLimit());
    }

    function _recordBridgeOperation(bool _register, bytes32 _messageId, address _token, address _sender, uint256 _value)
        internal
    {
        setMessageToken(_messageId, _token);
        setMessageRecipient(_messageId, _sender);
        setMessageValue(_messageId, _value);

        if (_register) {
            _setTokenRegistrationMessageId(_token, _messageId);
        }

        emit TokensBridgingInitiated(_token, _sender, _value, _messageId);
    }

    function _prepareMessage(
        bool _isKnownToken,
        bool _isNativeToken,
        address _token,
        address _receiver,
        uint256 _value,
        uint8 _decimals
    ) internal returns (bytes memory) {
        // process already known token that is native w.r.t. current chain
        if (_isKnownToken && _isNativeToken) {
            _setMediatorBalance(_token, mediatorBalance(_token).add(_value));
            return abi.encodeWithSelector(this.handleBridgedTokens.selector, _token, _receiver, _value);
        }

        // process already known token that is bridged from other chain
        if (_isKnownToken) {
            IBurnableMintableERC677Token(_token).burn(_value);
            return
                abi.encodeWithSelector(this.handleNativeTokens.selector, nativeTokenAddress(_token), _receiver, _value);
        }

        // process token that was not previously seen
        string memory name = TokenReader.readName(_token);
        string memory symbol = TokenReader.readSymbol(_token);

        require(bytes(name).length > 0 || bytes(symbol).length > 0);

        _setMediatorBalance(_token, _value);
        return
            abi.encodeWithSelector(
                this.deployAndHandleBridgedTokens.selector,
                _token,
                name,
                symbol,
                _decimals,
                _receiver,
                _value
            );
    }

    function _createBridgedToken(address _token, string _name, string _symbol, uint8 _decimals)
        internal
        returns (address)
    {
        string memory name = _name;
        string memory symbol = _symbol;
        require(bytes(name).length > 0 || bytes(symbol).length > 0);
        if (bytes(name).length == 0) {
            name = symbol;
        } else if (bytes(symbol).length == 0) {
            symbol = name;
        }
        name = _transformName(name);
        address bridgedToken = tokenFactory().deploy(name, symbol, _decimals, bridgeContract().sourceChainId());
        _setTokenAddressPair(_token, bridgedToken);
        _initToken(bridgedToken, _decimals);
        return bridgedToken;
    }

    function _initToken(address _token, uint8 _decimals) internal {
        _initializeTokenBridgeLimits(_token, _decimals);
    }

    function _transformName(string memory _name) internal returns (string memory);
}
