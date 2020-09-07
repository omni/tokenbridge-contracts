pragma solidity 0.4.24;

import "./BasicMultiAMBErc20ToErc677.sol";
import "./TokenProxy.sol";
import "./HomeFeeManagerMultiAMBErc20ToErc677.sol";
import "../../interfaces/IBurnableMintableERC677Token.sol";

/**
 * @title HomeMultiAMBErc20ToErc677
 * @dev Home side implementation for multi-erc20-to-erc677 mediator intended to work on top of AMB bridge.
 * It is designed to be used as an implementation contract of EternalStorageProxy contract.
 */
contract HomeMultiAMBErc20ToErc677 is BasicMultiAMBErc20ToErc677, HomeFeeManagerMultiAMBErc20ToErc677 {
    bytes32 internal constant TOKEN_IMAGE_CONTRACT = 0x20b8ca26cc94f39fab299954184cf3a9bd04f69543e4f454fab299f015b8130f; // keccak256(abi.encodePacked("tokenImageContract"))

    event NewTokenRegistered(address indexed foreignToken, address indexed homeToken);

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
     * @param _rewardAddreses list of reward addresses, between whom fees will be distributed.
     * @param _fees array with initial fees for both bridge firections.
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
        address[] _rewardAddreses,
        uint256[2] _fees // [ 0 = homeToForeignFee, 1 = foreignToHomeFee ]
    ) external onlyRelevantSender returns (bool) {
        require(!isInitialized());
        require(_owner != address(0));

        _setBridgeContract(_bridgeContract);
        _setMediatorContractOnOtherSide(_mediatorContract);
        _setLimits(address(0), _dailyLimitMaxPerTxMinPerTxArray);
        _setExecutionLimits(address(0), _executionDailyLimitExecutionMaxPerTxArray);
        _setRequestGasLimit(_requestGasLimit);
        setOwner(_owner);
        _setTokenImage(_tokenImage);
        if (_rewardAddreses.length > 0) {
            _setRewardAddressList(_rewardAddreses);
        }
        _setFee(HOME_TO_FOREIGN_FEE, address(0), _fees[0]);
        _setFee(FOREIGN_TO_HOME_FEE, address(0), _fees[1]);

        setInitialize();

        return isInitialized();
    }

    /**
     * @dev Updates an address of the token image contract used for proxifying newly created tokens.
     * @param _tokenImage address of PermittableToken contract.
     */
    function setTokenImage(address _tokenImage) external onlyOwner {
        _setTokenImage(_tokenImage);
    }

    /**
     * @dev Retrieves address of the token image contract.
     * @return address of block reward contract.
     */
    function tokenImage() public view returns (address) {
        return addressStorage[TOKEN_IMAGE_CONTRACT];
    }

    /**
     * @dev Handles the bridged tokens for the first time, includes deployment of new TokenProxy contract.
     * Checks that the value is inside the execution limits and invokes the method
     * to execute the Mint or Unlock accordingly.
     * @param _token address of the bridged ERC20/ERC677 token on the foreign side.
     * @param _name name of the bridged token, "x" will be appended, if empty, symbol will be used instead.
     * @param _symbol symbol of the bridged token, "x" will be appended, if empty, name will be used instead.
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
     * @dev Handles the bridged tokens. Checks that the value is inside the execution limits and invokes the method
     * to execute the Mint or Unlock accordingly.
     * @param _token bridged ERC20 token.
     * @param _recipient address that will receive the tokens.
     * @param _value amount of tokens to be received.
     */
    function handleBridgedTokens(
        ERC677 _token,
        address _recipient,
        uint256 _value
    ) external onlyMediator {
        ERC677 homeToken = ERC677(homeTokenAddress(_token));
        require(isTokenRegistered(homeToken));
        _handleBridgedTokens(homeToken, _recipient, _value);
    }

    /**
     * @dev ERC677 transfer callback function.
     * @param _from address of tokens sender.
     * @param _value amount of transferred tokens.
     * @param _data additional transfer data, can be used for passing alternative receiver address.
     */
    function onTokenTransfer(
        address _from,
        uint256 _value,
        bytes _data
    ) public returns (bool) {
        // if onTokenTransfer is called as a part of call to _relayTokens, this callback does nothing
        if (!lock()) {
            ERC677 token = ERC677(msg.sender);
            // if msg.sender if not a valid token contract, this check will fail, since limits are zeros
            // so the following check is not needed
            // require(isTokenRegistered(token));
            require(withinLimit(token, _value));
            addTotalSpentPerDay(token, getCurrentDay(), _value);
            bridgeSpecificActionsOnTokenTransfer(token, _from, _value, _data);
        }
        return true;
    }

    /**
     * @dev Validates that the token amount is inside the limits, calls transferFrom to transfer the tokens to the contract
     * and invokes the method to burn/lock the tokens and unlock/mint the tokens on the other network.
     * The user should first call Approve method of the ERC677 token.
     * @param token bridge token contract address.
     * @param _receiver address that will receive the native tokens on the other network.
     * @param _value amount of tokens to be transferred to the other network.
     */
    function _relayTokens(
        ERC677 token,
        address _receiver,
        uint256 _value
    ) internal {
        // This lock is to prevent calling passMessage twice if a ERC677 token is used.
        // When transferFrom is called, after the transfer, the ERC677 token will call onTokenTransfer from this contract
        // which will call passMessage.
        require(!lock());
        address to = address(this);
        // if msg.sender if not a valid token contract, this check will fail, since limits are zeros
        // so the following check is not needed
        // require(isTokenRegistered(token));
        require(withinLimit(token, _value));
        addTotalSpentPerDay(token, getCurrentDay(), _value);

        setLock(true);
        token.transferFrom(msg.sender, to, _value);
        setLock(false);
        bridgeSpecificActionsOnTokenTransfer(token, msg.sender, _value, abi.encodePacked(_receiver));
    }

    /**
     * @dev Executes action on the request to deposit tokens relayed from the other network
     * @param _recipient address of tokens receiver
     * @param _value amount of bridged tokens
     */
    function executeActionOnBridgedTokens(
        address _token,
        address _recipient,
        uint256 _value
    ) internal {
        bytes32 _messageId = messageId();
        uint256 valueToMint = _value;
        uint256 fee = _distributeFee(FOREIGN_TO_HOME_FEE, _token, valueToMint);
        if (fee > 0) {
            emit FeeDistributed(fee, _token, _messageId);
            valueToMint = valueToMint.sub(fee);
        }
        IBurnableMintableERC677Token(_token).mint(_recipient, valueToMint);
        emit TokensBridged(_token, _recipient, valueToMint, _messageId);
    }

    /**
     * @dev Mints back the amount of tokens that were bridged to the other network but failed.
     * @param _token address that bridged token contract.
     * @param _recipient address that will receive the tokens.
     * @param _value amount of tokens to be received.
     */
    function executeActionOnFixedTokens(
        address _token,
        address _recipient,
        uint256 _value
    ) internal {
        IBurnableMintableERC677Token(_token).mint(_recipient, _value);
    }

    /**
     * @dev Retrieves address of the home bridged token contract associated with a specific foreign token contract.
     * @param _foreignToken address of the created home token contract.
     * @return address of the home token contract.
     */
    function homeTokenAddress(address _foreignToken) public view returns (address) {
        return addressStorage[keccak256(abi.encodePacked("homeTokenAddress", _foreignToken))];
    }

    /**
     * @dev Retrieves address of the foreign bridged token contract associated with a specific home token contract.
     * @param _homeToken address of the created home token contract.
     * @return address of the foreign token contract.
     */
    function foreignTokenAddress(address _homeToken) public view returns (address) {
        return addressStorage[keccak256(abi.encodePacked("foreignTokenAddress", _homeToken))];
    }

    /**
     * @dev Internal function for updating an address of the token image contract.
     * @param _foreignToken address of bridged foreign token contract.
     * @param _foreignToken address of created home token contract.
     */
    function _setTokenAddressPair(address _foreignToken, address _homeToken) internal {
        addressStorage[keccak256(abi.encodePacked("homeTokenAddress", _foreignToken))] = _homeToken;
        addressStorage[keccak256(abi.encodePacked("foreignTokenAddress", _homeToken))] = _foreignToken;
    }

    /**
     * @dev Internal function for updating an address of the token image contract.
     * @param _tokenImage address of deployed PermittableToken contract.
     */
    function _setTokenImage(address _tokenImage) internal {
        require(AddressUtils.isContract(_tokenImage));
        addressStorage[TOKEN_IMAGE_CONTRACT] = _tokenImage;
    }

    /**
     * @dev Executes action on withdrawal of bridged tokens
     * @param _token address of token contract
     * @param _from address of tokens sender
     * @param _value requsted amount of bridged tokens
     * @param _data alternative receiver, if specified
     */
    function bridgeSpecificActionsOnTokenTransfer(
        ERC677 _token,
        address _from,
        uint256 _value,
        bytes _data
    ) internal {
        if (!lock()) {
            bytes32 _messageId = messageId();
            uint256 valueToBridge = _value;
            uint256 fee = _distributeFee(HOME_TO_FOREIGN_FEE, _token, valueToBridge);
            if (fee > 0) {
                emit FeeDistributed(fee, _token, _messageId);
                valueToBridge = valueToBridge.sub(fee);
            }
            IBurnableMintableERC677Token(_token).burn(valueToBridge);
            passMessage(_token, _from, chooseReceiver(_from, _data), valueToBridge);
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
     */
    function passMessage(
        ERC677 _token,
        address _from,
        address _receiver,
        uint256 _value
    ) internal {
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
}
