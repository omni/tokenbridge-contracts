pragma solidity 0.4.24;

import "./BasicStakeTokenMediator.sol";
import "../BlockRewardBridge.sol";
import "./HomeStakeTokenFeeManager.sol";
import "../../interfaces/IBurnableMintableERC677Token.sol";

contract HomeStakeTokenMediator is BasicStakeTokenMediator, HomeStakeTokenFeeManager {
    /**
     * Initializes rewardable home mediator
     * @param _bridgeContract HomeAMB bridge contract
     * @param _mediatorContract address of the mediator contract in the Foreign chain
     * @param _erc677token address of STAKE token in the Home chain
     * @param _dailyLimitMaxPerTxMinPerTxArray Home limits for outgoing transfers
     * @param _executionDailyLimitExecutionMaxPerTxArray Home execution limits for incoming transfers
     * @param _requestGasLimit gas limit used for AMB operations
     * @param _decimalShift decimal shift for bridged TAKE token
     * @param _owner address of new bridge owner
     * @param _blockReward address of block reward contract used for fee distribution
     * @param _fee initial home fee
     */
    function rewardableInitialize(
        address _bridgeContract,
        address _mediatorContract,
        address _erc677token,
        uint256[] _dailyLimitMaxPerTxMinPerTxArray, // [ 0 = _dailyLimit, 1 = _maxPerTx, 2 = _minPerTx ]
        uint256[] _executionDailyLimitExecutionMaxPerTxArray, // [ 0 = _executionDailyLimit, 1 = _executionMaxPerTx ]
        uint256 _requestGasLimit,
        uint256 _decimalShift,
        address _owner,
        address _blockReward,
        uint256 _fee
    ) external returns (bool) {
        _setFee(_fee);
        _setBlockRewardContract(_blockReward);
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
     * @dev Allows to transfer token ownership to different proxy contract.
     * Can be called only once, when mediator is the current owner of a token.
     * All subsequent calls to erc677 token will be done through new proxy contract.
     * @param _owner token proxy contract address
     */
    function transferTokenOwnership(address _owner) external onlyOwner {
        require(AddressUtils.isContract(_owner));
        Ownable(erc677token()).transferOwnership(_owner);
        setErc677token(_owner);
    }

    /**
     * @dev Executes action on fixed tokens
     * @param _recipient address of tokens receiver
     * @param _value amount of fixed tokens
     */
    function executeActionOnBridgedTokens(address _recipient, uint256 _value) internal {
        uint256 value = _value.mul(10**decimalShift());
        IBurnableMintableERC677Token(erc677token()).mint(_recipient, value);
    }

    /**
     * @dev Executes action on incoming bridged tokens
     * @param _token address of token contract
     * @param _from address of tokens sender
     * @param _value requsted amount of bridged tokens
     * @param _data alternative receiver, if specified
     */
    function bridgeSpecificActionsOnTokenTransfer(ERC677 _token, address _from, uint256 _value, bytes _data) internal {
        if (!lock()) {
            // burn all incoming tokens
            IBurnableMintableERC677Token(_token).burn(_value);

            if (address(_blockRewardContract()) == address(0)) {
                // in case if block reward contract is not configured, the fee is not collected
                passMessage(chooseReceiver(_from, _data), _value);
            } else {
                // when block contract is defined, the calculated fee is substructed from the original value
                uint256 fee = calculateFee(_value);
                passMessage(chooseReceiver(_from, _data), _value.sub(fee));
                if (fee > 0) {
                    // the fee itself is distributed later in the block reward contract
                    _blockRewardContract().addBridgeTokenRewardReceivers(fee);
                }
            }
        }
    }

    /**
     * @dev Executes action on fixed tokens
     * @param _recipient address of tokens receiver
     * @param _value amount of fixed tokens
     */
    function executeActionOnFixedTokens(address _recipient, uint256 _value) internal {
        IBurnableMintableERC677Token(erc677token()).mint(_recipient, _value);
    }
}
