pragma solidity 0.4.24;

import "./BasicMultiAMBErc20ToErc677.sol";
import "./TokenProxy.sol";
import "../../interfaces/IBurnableMintableERC677Token.sol";

/**
* @title HomeMultiAMBErc20ToErc677
* @dev Home side implementation for multi-erc20-to-erc677 mediator intended to work on top of AMB bridge.
* It is designed to be used as an implementation contract of EternalStorageProxy contract.
*/
contract HomeMultiAMBErc20ToErc677 is BasicMultiAMBErc20ToErc677 {
    bytes32 internal constant TOKEN_IMAGE_CONTRACT = 0x20b8ca26cc94f39fab299954184cf3a9bd04f69543e4f454fab299f015b8130f; // keccak256(abi.encodePacked("tokenImageContract"))

    function initialize(
        address _bridgeContract,
        address _mediatorContract,
        uint256[3] _dailyLimitMaxPerTxMinPerTxArray, // [ 0 = _dailyLimit, 1 = _maxPerTx, 2 = _minPerTx ]
        uint256[2] _executionDailyLimitExecutionMaxPerTxArray, // [ 0 = _executionDailyLimit, 1 = _executionMaxPerTx ]
        uint256 _requestGasLimit,
        address _owner,
        address _tokenImage
    ) external onlyRelevantSender returns (bool) {
        require(!isInitialized());

        _setBridgeContract(_bridgeContract);
        _setMediatorContractOnOtherSide(_mediatorContract);
        _setLimits(address(0), _dailyLimitMaxPerTxMinPerTxArray);
        _setExecutionLimits(address(0), _executionDailyLimitExecutionMaxPerTxArray);
        _setRequestGasLimit(_requestGasLimit);
        setOwner(_owner);
        _setTokenImageContract(_tokenImage);
        setInitialize();

        return isInitialized();
    }

    /**
     * @dev Executes action on the request to deposit tokens relayed from the other network
     * @param _recipient address of tokens receiver
     * @param _value amount of bridged tokens
     */
    function executeActionOnBridgedTokens(address _token, address _recipient, uint256 _value) internal {
        bytes32 _messageId = messageId();
        IBurnableMintableERC677Token(_token).mint(_recipient, _value);
        emit TokensBridged(_token, _recipient, _value, _messageId);
    }

    function executeActionOnFixedTokens(address _token, address _recipient, uint256 _value) internal {
        IBurnableMintableERC677Token(_token).mint(_recipient, _value);
    }

    function setTokenImageContract(address _tokenImage) external onlyOwner {
        _setTokenImageContract(_tokenImage);
    }

    function _setTokenImageContract(address _tokenImage) internal {
        require(AddressUtils.isContract(_tokenImage));
        addressStorage[TOKEN_IMAGE_CONTRACT] = _tokenImage;
    }

    function tokenImageContract() public view returns (address) {
        return addressStorage[TOKEN_IMAGE_CONTRACT];
    }

    function deployAndHandleBridgedTokens(
        address _token,
        string _name,
        string _symbol,
        uint8 _decimals,
        address _recipient,
        uint256 _value
    ) external {
        string memory name = _name;
        string memory symbol = _symbol;
        if (bytes(name).length == 0) {
            name = symbol;
        } else if (bytes(symbol).length == 0) {
            symbol = name;
        }
        name = string(abi.encodePacked("x", name));
        symbol = string(abi.encodePacked("x", symbol));
        ERC677 homeToken = ERC677(
            new TokenProxy(tokenImageContract(), name, symbol, _decimals, bridgeContract().sourceChainId())
        );
        _setHomeTokenAddress(_token, homeToken);
        _setForeignTokenAddress(homeToken, _token);
        _initializeTokenBridgeLimits(homeToken, _decimals);
        super.handleBridgedTokens(homeToken, _recipient, _value);
    }

    /**
    * @dev Call AMB bridge to require the invocation of handleBridgedTokens method of the mediator on the other network.
    * Store information related to the bridged tokens in case the message execution fails on the other network
    * and the action needs to be fixed/rolled back.
    * @param _token bridged ERC20 token
    * @param _from address of sender, if bridge operation fails, tokens will be returned to this address
    * @param _receiver address of receiver on the other side, will eventually receive bridged tokens
    * @param _value bridged amount of tokens
    */
    function passMessage(ERC677 _token, address _from, address _receiver, uint256 _value) internal {
        bytes4 methodSelector = this.handleBridgedTokens.selector;
        address foreignToken = foreignTokenAddress(_token);
        bytes memory data = abi.encodeWithSelector(methodSelector, foreignToken, _receiver, _value);

        bytes32 _messageId = bridgeContract().requireToPassMessage(
            mediatorContractOnOtherSide(),
            data,
            requestGasLimit()
        );

        setMessageToken(_messageId, _token);
        setMessageValue(_messageId, _value);
        setMessageRecipient(_messageId, _from);
    }

    /**
    * @dev Handles the bridged tokens. Checks that the value is inside the execution limits and invokes the method
    * to execute the Mint or Unlock accordingly.
    * @param _token bridged ERC20 token
    * @param _recipient address that will receive the tokens
    * @param _value amount of tokens to be received
    */
    function handleBridgedTokens(ERC677 _token, address _recipient, uint256 _value) public {
        ERC677 homeToken = ERC677(homeTokenAddress(_token));
        super.handleBridgedTokens(homeToken, _recipient, _value);
    }

    function homeTokenAddress(address _foreignToken) internal view returns (address) {
        return addressStorage[keccak256(abi.encodePacked("homeTokenAddress", _foreignToken))];
    }

    function foreignTokenAddress(address _homeToken) internal view returns (address) {
        return addressStorage[keccak256(abi.encodePacked("foreignTokenAddress", _homeToken))];
    }

    function _setHomeTokenAddress(address _foreignToken, address _homeToken) internal {
        addressStorage[keccak256(abi.encodePacked("homeTokenAddress", _foreignToken))] = _homeToken;
    }

    function _setForeignTokenAddress(address _homeToken, address _foreignToken) internal {
        addressStorage[keccak256(abi.encodePacked("foreignTokenAddress", _homeToken))] = _foreignToken;
    }

    /**
     * @dev Executes action on withdrawal of bridged tokens
     * @param _token address of token contract
     * @param _from address of tokens sender
     * @param _value requsted amount of bridged tokens
     * @param _data alternative receiver, if specified
     */
    function bridgeSpecificActionsOnTokenTransfer(ERC677 _token, address _from, uint256 _value, bytes _data) internal {
        if (!lock()) {
            IBurnableMintableERC677Token(_token).burn(_value);
            passMessage(_token, _from, chooseReceiver(_from, _data), _value);
        }
    }
}
