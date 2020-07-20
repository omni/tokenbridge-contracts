pragma solidity 0.4.24;

import "openzeppelin-solidity/contracts/token/ERC20/DetailedERC20.sol";
import "./BasicMultiAMBErc20ToErc677.sol";
import "./ForeignFeeManagerMultiAMBErc20ToErc677.sol";
import "../../libraries/TokenReader.sol";

/**
 * @title ForeignMultiAMBErc20ToErc677
 * @dev Foreign side implementation for multi-erc20-to-erc677 mediator intended to work on top of AMB bridge.
 * It is designed to be used as an implementation contract of EternalStorageProxy contract.
 */
contract ForeignMultiAMBErc20ToErc677 is BasicMultiAMBErc20ToErc677, ForeignFeeManagerMultiAMBErc20ToErc677 {
    bytes4 internal constant DEPLOY_AND_HANDLE_BRIDGE_TOKENS = 0x2ae87cdd; // deployAndHandleBridgedTokens(address,string,string,uint8,address,uint256)

    function initialize(
        address _bridgeContract,
        address _mediatorContract,
        uint256[3] _dailyLimitMaxPerTxMinPerTxArray, // [ 0 = _dailyLimit, 1 = _maxPerTx, 2 = _minPerTx ]
        uint256[2] _executionDailyLimitExecutionMaxPerTxArray, // [ 0 = _executionDailyLimit, 1 = _executionMaxPerTx ]
        uint256 _requestGasLimit,
        address _owner,
        address[] _rewardAddreses,
        uint256[2] _fees // [ 0 = homeToForeignFee, 1 = foreignToHomeFee ]
    ) external onlyRelevantSender returns (bool) {
        require(!isInitialized());

        _setBridgeContract(_bridgeContract);
        _setMediatorContractOnOtherSide(_mediatorContract);
        _setLimits(address(0), _dailyLimitMaxPerTxMinPerTxArray);
        _setExecutionLimits(address(0), _executionDailyLimitExecutionMaxPerTxArray);
        _setRequestGasLimit(_requestGasLimit);
        setOwner(_owner);
        _setRewardAddressList(_rewardAddreses);
        _setFee(HOME_TO_FOREIGN_FEE, address(0), _fees[0]);
        _setFee(FOREIGN_TO_HOME_FEE, address(0), _fees[1]);
        setInitialize();

        return isInitialized();
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
        uint256 fee = _distributeFee(HOME_TO_FOREIGN_FEE, _token, valueToTransfer);
        if (fee > 0) {
            emit FeeDistributed(fee, _token, _messageId);
            valueToTransfer = valueToTransfer.sub(fee);
        }
        ERC677(_token).transfer(_recipient, valueToTransfer);
        _setMediatorBalance(_token, mediatorBalance(_token).sub(_value));
        emit TokensBridged(_token, _recipient, valueToTransfer, _messageId);
    }

    /**
     * @dev Executes action on deposit of bridged tokens
     * @param _token address of the token contract
     * @param _from address of tokens sender
     * @param _value requsted amount of bridged tokens
     * @param _data alternative receiver, if specified
     */
    function bridgeSpecificActionsOnTokenTransfer(ERC677 _token, address _from, uint256 _value, bytes _data) internal {
        if (lock()) return;

        bytes memory data;
        address receiver = chooseReceiver(_from, _data);
        uint256 valueToBridge = _value;
        uint256 fee = _distributeFee(FOREIGN_TO_HOME_FEE, _token, valueToBridge);
        if (fee > 0) {
            emit FeeDistributed(fee, _token, _messageId);
            valueToBridge = valueToBridge.sub(fee);
        }

        if (minPerTx(_token) > 0) {
            data = abi.encodeWithSelector(this.handleBridgedTokens.selector, _token, receiver, valueToBridge);
        } else {
            bytes memory name = bytes(TokenReader.readName(_token));
            bytes memory symbol = bytes(TokenReader.readSymbol(_token));
            if (name.length == 0 && symbol.length == 0) {
                revert();
            }
            if (name.length == 0) {
                name = symbol;
            } else if (symbol.length == 0) {
                symbol = name;
            }
            uint256 decimals = TokenReader.readDecimals(_token);

            data = abi.encodeWithSelector(
                DEPLOY_AND_HANDLE_BRIDGE_TOKENS,
                _token,
                name,
                symbol,
                decimals,
                receiver,
                valueToBridge
            );

            _initializeTokenBridgeLimits(_token, decimals);
        }

        require(withinLimit(_token, _value));
        addTotalSpentPerDay(_token, getCurrentDay(), _value);

        // avoid stack too deep error by using existing variable
        fee = mediatorBalance(_token).add(valueToBridge);
        _setMediatorBalance(_token, fee);

        bytes32 _messageId = bridgeContract().requireToPassMessage(
            mediatorContractOnOtherSide(),
            data,
            requestGasLimit()
        );

        setMessageToken(_messageId, _token);
        setMessageValue(_messageId, valueToBridge);
        setMessageRecipient(_messageId, _from);
    }

    function executeActionOnFixedTokens(address _token, address _recipient, uint256 _value) internal {
        _setMediatorBalance(_token, mediatorBalance(_token).sub(_value));
        ERC677(_token).transfer(_recipient, _value);
    }

    /**
    * @dev Allows to send to the other network the amount of locked native tokens that can be forced into the contract
    * without the invocation of the required methods.
    * @param _receiver the address that will receive the tokens on the other network
    */
    function fixMediatorBalance(address _token, address _receiver) public onlyIfUpgradeabilityOwner {
        uint256 balance = ERC677(_token).balanceOf(address(this));
        uint256 expectedBalance = mediatorBalance(_token);
        require(balance > expectedBalance);
        uint256 diff = balance - expectedBalance;
        addTotalSpentPerDay(_token, getCurrentDay(), diff);
        _setMediatorBalance(_token, balance);

        bytes memory data = abi.encodeWithSelector(this.handleBridgedTokens.selector, _token, _receiver, diff);

        bytes32 _messageId = bridgeContract().requireToPassMessage(
            mediatorContractOnOtherSide(),
            data,
            requestGasLimit()
        );

        setMessageToken(_messageId, _token);
        setMessageValue(_messageId, diff);
        setMessageRecipient(_messageId, _receiver);
    }

    /**
    * @dev Tells the token balance of the contract.
    * @param _token address of the associated token contract.
    * @return the current tracked token balance of the contract.
    */
    function mediatorBalance(address _token) public view returns (uint256) {
        return uintStorage[keccak256(abi.encodePacked("mediatorBalance", _token))];
    }

    /**
    * @dev Sets the updated token balance of the contract.
    * @param _token address of the associated token contract.
    * @param _balance the new token balance of the contract.
    */
    function _setMediatorBalance(address _token, uint256 _balance) internal {
        uintStorage[keccak256(abi.encodePacked("mediatorBalance", _token))] = _balance;
    }
}
