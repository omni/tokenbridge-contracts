pragma solidity 0.4.24;

import "../../interfaces/IMintHandler.sol";
import "./BasicStakeTokenMediator.sol";
import "./HomeStakeTokenFeeManager.sol";
import "../../interfaces/IBurnableMintableERC677Token.sol";

/**
 * @title HomeStakeTokenMediator
 * @dev Home side implementation for stake token mediator intended to work on top of AMB bridge.
 * It is designed to be used as an implementation contract of EternalStorageProxy contract.
 */
contract HomeStakeTokenMediator is BasicStakeTokenMediator, HomeStakeTokenFeeManager {
    bytes32 internal constant MINT_HANDLER = 0x8a8236f871f2bbb44f59e8c68b82f7587d19c987e09aba39148cc97ea004a32e; // keccak256(abi.encodePacked("mintHandler"))

    /**
     * Initializes home mediator
     * @param _bridgeContract HomeAMB bridge contract
     * @param _mediatorContract address of the mediator contract in the Foreign chain
     * @param _erc677token address of STAKE token in the Home chain
     * @param _dailyLimitMaxPerTxMinPerTxArray Home limits for outgoing transfers
     * @param _executionDailyLimitExecutionMaxPerTxArray Home execution limits for incoming transfers
     * @param _requestGasLimit gas limit used for AMB operations
     * @param _decimalShift decimal shift for bridged STAKE token
     * @param _owner address of new bridge owner
     */
    function initialize(
        address _bridgeContract,
        address _mediatorContract,
        address _erc677token,
        uint256[3] _dailyLimitMaxPerTxMinPerTxArray, // [ 0 = _dailyLimit, 1 = _maxPerTx, 2 = _minPerTx ]
        uint256[2] _executionDailyLimitExecutionMaxPerTxArray, // [ 0 = _executionDailyLimit, 1 = _executionMaxPerTx ]
        uint256 _requestGasLimit,
        int256 _decimalShift,
        address _owner
    ) public returns (bool) {
        addressStorage[MINT_HANDLER] = _erc677token;
        return
            super.initialize(
                _bridgeContract,
                _mediatorContract,
                _erc677token,
                _dailyLimitMaxPerTxMinPerTxArray,
                _executionDailyLimitExecutionMaxPerTxArray,
                _requestGasLimit,
                _decimalShift,
                _owner
            );
    }

    /**
     * Initializes rewardable home mediator
     * @param _bridgeContract HomeAMB bridge contract
     * @param _mediatorContract address of the mediator contract in the Foreign chain
     * @param _erc677token address of STAKE token in the Home chain
     * @param _dailyLimitMaxPerTxMinPerTxArray Home limits for outgoing transfers
     * @param _executionDailyLimitExecutionMaxPerTxArray Home execution limits for incoming transfers
     * @param _requestGasLimit gas limit used for AMB operations
     * @param _decimalShift decimal shift for bridged STAKE token
     * @param _owner address of new bridge owner
     * @param _blockReward address of block reward contract used for fee distribution
     * @param _fee initial home fee
     */
    function rewardableInitialize(
        address _bridgeContract,
        address _mediatorContract,
        address _erc677token,
        uint256[3] _dailyLimitMaxPerTxMinPerTxArray, // [ 0 = _dailyLimit, 1 = _maxPerTx, 2 = _minPerTx ]
        uint256[2] _executionDailyLimitExecutionMaxPerTxArray, // [ 0 = _executionDailyLimit, 1 = _executionMaxPerTx ]
        uint256 _requestGasLimit,
        int256 _decimalShift,
        address _owner,
        address _blockReward,
        uint256 _fee
    ) external returns (bool) {
        _setFee(_fee);
        _setBlockRewardContract(_blockReward);
        return
            initialize(
                _bridgeContract,
                _mediatorContract,
                _erc677token,
                _dailyLimitMaxPerTxMinPerTxArray,
                _executionDailyLimitExecutionMaxPerTxArray,
                _requestGasLimit,
                _decimalShift,
                _owner
            );
    }

    /**
     * @dev Allows to transfer token ownership to different proxy contract.
     * Can be called only once, when mediator is the current owner of a token.
     * All subsequent calls to erc677 token will be done through new proxy contract.
     * @param _owner token proxy contract address
     */
    function transferTokenOwnership(address _owner) external onlyOwner {
        Ownable(erc677token()).transferOwnership(_owner);
    }

    /**
     * @dev Updates address of contract used for handling mint operations,
     * all subsequent mint operations will be called through this contract
     * @param _mintHandler address of new contract
     */
    function setMintHandler(address _mintHandler) external onlyOwner {
        require(AddressUtils.isContract(_mintHandler));
        addressStorage[MINT_HANDLER] = _mintHandler;
    }

    /**
     * @dev Retrieves currently used contract for handling mint operations, defaults to token itself
     * @return address of mint handler contract
     */
    function getMintHandler() public view returns (IMintHandler) {
        return IMintHandler(addressStorage[MINT_HANDLER]);
    }

    /**
     * @dev Executes action on the request to deposit tokens relayed from the other network
     * @param _recipient address of tokens receiver
     * @param _value amount of bridged tokens
     */
    function executeActionOnBridgedTokens(address _recipient, uint256 _value) internal {
        uint256 value = _shiftValue(_value);
        bytes32 _messageId = messageId();
        getMintHandler().mint(_recipient, value);
        emit TokensBridged(_recipient, value, _messageId);
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
            // burn all incoming tokens
            IBurnableMintableERC677Token(_token).burn(_value);

            if (isFeeCollectingActivated()) {
                uint256 fee = calculateFee(_value);
                // the calculated fee is subtracted from the original value
                passMessage(_from, chooseReceiver(_from, _data), _value.sub(fee));
                if (fee > 0) {
                    // the fee manager will take care about fee distribution
                    _distributeFee(fee);
                }
            } else {
                passMessage(_from, chooseReceiver(_from, _data), _value);
            }
        }
    }

    /**
     * @dev Executes action on relayed request to fix the failed transfer of tokens
     * @param _recipient address of tokens receiver
     * @param _value amount of fixed tokens
     */
    function executeActionOnFixedTokens(address _recipient, uint256 _value) internal {
        getMintHandler().mint(_recipient, _value);
    }
}
