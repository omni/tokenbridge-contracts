pragma solidity 0.4.24;

import "../../interfaces/IBurnableMintableERC677Token.sol";
import "./BasicMultiAMBErc20ToErc677.sol";
import "./HomeFeeManagerMultiAMBErc20ToErc677.sol";
import "./modules/forwarding_rules/MultiTokenForwardingRulesConnector.sol";

/**
* @title HomeMultiAMBErc20ToErc677
* @dev Home side implementation for universal multi-erc20-to-erc677 mediator intended to work on top of AMB bridge.
* It is designed to be used as an implementation contract of EternalStorageProxy contract.
*/
contract HomeMultiAMBErc20ToErc677 is
    BasicMultiAMBErc20ToErc677,
    HomeFeeManagerMultiAMBErc20ToErc677,
    MultiTokenForwardingRulesConnector
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
    * @param _tokenFactory address of the TokenFactory contract that will be used for the deployment of new tokens.
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
        address _tokenFactory,
        address[] _rewardAddresses,
        uint256[2] _fees // [ 0 = homeToForeignFee, 1 = foreignToHomeFee ]
    ) external onlyRelevantSender returns (bool) {
        require(!isInitialized());

        _setBridgeContract(_bridgeContract);
        _setMediatorContractOnOtherSide(_mediatorContract);
        _setLimits(address(0), _dailyLimitMaxPerTxMinPerTxArray);
        _setExecutionLimits(address(0), _executionDailyLimitExecutionMaxPerTxArray);
        _setRequestGasLimit(_requestGasLimit);
        _setOwner(_owner);
        _setTokenFactory(_tokenFactory);
        if (_rewardAddresses.length > 0) {
            _setRewardAddressList(_rewardAddresses);
        }
        _setFee(HOME_TO_FOREIGN_FEE, address(0), _fees[0]);
        _setFee(FOREIGN_TO_HOME_FEE, address(0), _fees[1]);

        setInitialize();

        return isInitialized();
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

        uint256 valueToBridge = _value;
        uint256 fee = _distributeFee(FOREIGN_TO_HOME_FEE, _isNative, _token, valueToBridge);
        bytes32 _messageId = messageId();
        if (fee > 0) {
            emit FeeDistributed(fee, _token, _messageId);
            valueToBridge = valueToBridge.sub(fee);
        }

        if (_isNative) {
            _token.safeTransfer(_recipient, valueToBridge);
            _setMediatorBalance(_token, mediatorBalance(_token).sub(_value));
        } else {
            IBurnableMintableERC677Token(_token).mint(_recipient, valueToBridge);
        }

        emit TokensBridged(_token, _recipient, valueToBridge, _messageId);
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
        bool isNativeToken = !isKnownToken || isRegisteredAsNativeToken(_token);

        // native unbridged token
        if (!isKnownToken) {
            decimals = uint8(TokenReader.readDecimals(_token));
            _initToken(_token, decimals);
        }

        require(withinLimit(_token, _value));
        addTotalSpentPerDay(_token, getCurrentDay(), _value);

        uint256 valueToBridge = _value;
        uint256 fee = 0;
        // Next line disables fee collection in case sender is one of the reward addresses.
        // It is needed to allow a 100% withdrawal of tokens from the home side.
        // If fees are not disabled for reward receivers, small fraction of tokens will always
        // be redistributed between the same set of reward addresses, which is not the desired behaviour.
        if (!isRewardAddress(_from)) {
            fee = _distributeFee(HOME_TO_FOREIGN_FEE, isNativeToken, _token, valueToBridge);
            valueToBridge = valueToBridge.sub(fee);
        }

        bytes memory data = _prepareMessage(isKnownToken, isNativeToken, _token, _receiver, valueToBridge, decimals);

        bytes32 _messageId = _passMessage(data, _token, _from, _receiver);
        _recordBridgeOperation(!isKnownToken, _messageId, _token, _from, valueToBridge);
        if (fee > 0) {
            emit FeeDistributed(fee, _token, _messageId);
        }
    }

    function _passMessage(bytes _data, address _token, address _from, address _receiver) internal returns (bytes32) {
        address executor = mediatorContractOnOtherSide();
        uint256 gasLimit = requestGasLimit();
        IAMB bridge = bridgeContract();

        // Address of the home token is used here for determining lane permissions.
        return
            _isOracleDrivenLaneAllowed(_token, _from, _receiver)
                ? bridge.requireToPassMessage(executor, _data, gasLimit)
                : bridge.requireToConfirmMessage(executor, _data, gasLimit);
    }

    function _initToken(address _token, uint8 _decimals) internal {
        _initializeTokenBridgeLimits(_token, _decimals);
        _setFee(HOME_TO_FOREIGN_FEE, _token, getFee(HOME_TO_FOREIGN_FEE, address(0)));
        _setFee(FOREIGN_TO_HOME_FEE, _token, getFee(FOREIGN_TO_HOME_FEE, address(0)));
    }

    function _transformName(string memory _name) internal returns (string memory) {
        return string(abi.encodePacked(_name, " on xDai"));
    }
}
