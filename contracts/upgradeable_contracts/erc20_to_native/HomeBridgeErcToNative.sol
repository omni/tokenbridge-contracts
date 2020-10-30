pragma solidity 0.4.24;

import "../../libraries/Message.sol";
import "../../upgradeability/EternalStorage.sol";
import "../../interfaces/IBlockReward.sol";
import "../BasicHomeBridge.sol";
import "../HomeOverdrawManagement.sol";
import "./RewardableHomeBridgeErcToNative.sol";
import "../BlockRewardBridge.sol";

/**
 * @title HomeBridgeErcToNative
 * @dev This contract Home side logic for the erc-to-native vanilla bridge mode.
 * It is designed to be used as an implementation contract of EternalStorageProxy contract.
 */
contract HomeBridgeErcToNative is
    EternalStorage,
    BasicHomeBridge,
    HomeOverdrawManagement,
    RewardableHomeBridgeErcToNative,
    BlockRewardBridge
{
    bytes32 internal constant TOTAL_BURNT_COINS = 0x17f187b2e5d1f8770602b32c1159b85c9600859277fae1eaa9982e9bcf63384c; // keccak256(abi.encodePacked("totalBurntCoins"))

    function() public payable {
        require(msg.data.length == 0);
        nativeTransfer(msg.sender);
    }

    function nativeTransfer(address _receiver) internal {
        require(msg.value > 0);
        require(withinLimit(msg.value));
        IBlockReward blockReward = blockRewardContract();
        uint256 totalMinted = blockReward.mintedTotallyByBridge(address(this));
        uint256 totalBurnt = totalBurntCoins();
        require(msg.value <= totalMinted.sub(totalBurnt));
        addTotalSpentPerDay(getCurrentDay(), msg.value);
        uint256 valueToTransfer = msg.value;
        address feeManager = feeManagerContract();
        uint256 valueToBurn = msg.value;
        if (feeManager != address(0)) {
            uint256 fee = calculateFee(valueToTransfer, false, feeManager, HOME_FEE);
            valueToTransfer = valueToTransfer.sub(fee);
            valueToBurn = getAmountToBurn(valueToBurn);
        }
        setTotalBurntCoins(totalBurnt.add(valueToBurn));
        address(0).transfer(valueToBurn);
        emit UserRequestForSignature(_receiver, valueToTransfer);
    }

    function relayTokens(address _receiver) external payable {
        nativeTransfer(_receiver);
    }

    function initialize(
        address _validatorContract,
        uint256[3] _dailyLimitMaxPerTxMinPerTxArray, // [ 0 = _dailyLimit, 1 = _maxPerTx, 2 = _minPerTx ]
        uint256 _homeGasPrice,
        uint256 _requiredBlockConfirmations,
        address _blockReward,
        uint256[2] _foreignDailyLimitForeignMaxPerTxArray, // [ 0 = _foreignDailyLimit, 1 = _foreignMaxPerTx ]
        address _owner,
        int256 _decimalShift
    ) external onlyRelevantSender returns (bool) {
        _initialize(
            _validatorContract,
            _dailyLimitMaxPerTxMinPerTxArray,
            _homeGasPrice,
            _requiredBlockConfirmations,
            _blockReward,
            _foreignDailyLimitForeignMaxPerTxArray,
            _owner,
            _decimalShift
        );
        setInitialize();

        return isInitialized();
    }

    function rewardableInitialize(
        address _validatorContract,
        uint256[3] _dailyLimitMaxPerTxMinPerTxArray, // [ 0 = _dailyLimit, 1 = _maxPerTx, 2 = _minPerTx ]
        uint256 _homeGasPrice,
        uint256 _requiredBlockConfirmations,
        address _blockReward,
        uint256[2] _foreignDailyLimitForeignMaxPerTxArray, // [ 0 = _foreignDailyLimit, 1 = _foreignMaxPerTx ]
        address _owner,
        address _feeManager,
        uint256[2] _homeFeeForeignFeeArray, // [ 0 = _homeFee, 1 = _foreignFee ]
        int256 _decimalShift
    ) external onlyRelevantSender returns (bool) {
        _initialize(
            _validatorContract,
            _dailyLimitMaxPerTxMinPerTxArray,
            _homeGasPrice,
            _requiredBlockConfirmations,
            _blockReward,
            _foreignDailyLimitForeignMaxPerTxArray,
            _owner,
            _decimalShift
        );
        require(AddressUtils.isContract(_feeManager));
        addressStorage[FEE_MANAGER_CONTRACT] = _feeManager;
        _setFee(_feeManager, _homeFeeForeignFeeArray[0], HOME_FEE);
        _setFee(_feeManager, _homeFeeForeignFeeArray[1], FOREIGN_FEE);
        setInitialize();

        return isInitialized();
    }

    function getBridgeMode() external pure returns (bytes4 _data) {
        return 0x18762d46; // bytes4(keccak256(abi.encodePacked("erc-to-native-core")))
    }

    function blockRewardContract() public view returns (IBlockReward) {
        return _blockRewardContract();
    }

    function totalBurntCoins() public view returns (uint256) {
        return uintStorage[TOTAL_BURNT_COINS];
    }

    function setBlockRewardContract(address _blockReward) external onlyOwner {
        _setBlockRewardContract(_blockReward);
    }

    /**
     * @dev Withdraws the erc20 tokens or native coins from this contract.
     * @param _token address of the claimed token or address(0) for native coins.
     * @param _to address of the tokens/coins receiver.
     */
    function claimTokens(address _token, address _to) external onlyIfUpgradeabilityOwner {
        // Since native coins are being minted by the blockReward contract and burned by sending them to the address(0),
        // they are not locked at the contract during the normal operation. However, they can be still forced into this contract
        // by using a selfdestruct opcode, or by using this contract address as a coinbase account.
        // In this case it is necessary to allow claiming native coins back.
        // Any other erc20 token can be safely claimed as well.
        claimValues(_token, _to);
    }

    function _initialize(
        address _validatorContract,
        uint256[3] _dailyLimitMaxPerTxMinPerTxArray, // [ 0 = _dailyLimit, 1 = _maxPerTx, 2 = _minPerTx ]
        uint256 _homeGasPrice,
        uint256 _requiredBlockConfirmations,
        address _blockReward,
        uint256[2] _foreignDailyLimitForeignMaxPerTxArray, // [ 0 = _foreignDailyLimit, 1 = _foreignMaxPerTx ]
        address _owner,
        int256 _decimalShift
    ) internal {
        require(!isInitialized());
        require(AddressUtils.isContract(_validatorContract));
        require(_blockReward == address(0) || AddressUtils.isContract(_blockReward));

        addressStorage[VALIDATOR_CONTRACT] = _validatorContract;
        uintStorage[DEPLOYED_AT_BLOCK] = block.number;
        _setLimits(_dailyLimitMaxPerTxMinPerTxArray);
        _setGasPrice(_homeGasPrice);
        _setRequiredBlockConfirmations(_requiredBlockConfirmations);
        addressStorage[BLOCK_REWARD_CONTRACT] = _blockReward;
        _setExecutionLimits(_foreignDailyLimitForeignMaxPerTxArray);
        _setDecimalShift(_decimalShift);
        _setOwner(_owner);
    }

    /**
     * @dev Internal callback to be called on successfull message execution.
     * Should be called only after enough affirmations from the validators are already collected.
     * @param _recipient address of the receiver where the new coins should be minted.
     * @param _value amount of coins to mint.
     * @param _txHash reference transaction hash on the Foreign side of the bridge which cause this operation.
     * @param _hashMsg unique identifier of the particular bridge operation.
     * @return true, if execution completed successfully.
     */
    function onExecuteAffirmation(address _recipient, uint256 _value, bytes32 _txHash, bytes32 _hashMsg)
        internal
        returns (bool)
    {
        _clearAboveLimitsMarker(_hashMsg, _value);
        addTotalExecutedPerDay(getCurrentDay(), _value);
        IBlockReward blockReward = blockRewardContract();
        require(blockReward != address(0));
        uint256 valueToMint = _shiftValue(_value);
        address feeManager = feeManagerContract();
        if (feeManager != address(0)) {
            uint256 fee = calculateFee(valueToMint, false, feeManager, FOREIGN_FEE);
            distributeFeeFromAffirmation(fee, feeManager, _txHash);
            valueToMint = valueToMint.sub(fee);
        }
        blockReward.addExtraReceiver(valueToMint, _recipient);
        return true;
    }

    /**
     * @dev Internal function to be called when enough signatures are collected.
     * Distributed the fee for collecting signatures.
     * @param _message encoded message signed by the validators.
     */
    function onSignaturesCollected(bytes _message) internal {
        address feeManager = feeManagerContract();
        if (feeManager != address(0)) {
            (, uint256 amount, bytes32 txHash, ) = Message.parseMessage(_message);
            uint256 fee = calculateFee(amount, true, feeManager, HOME_FEE);
            distributeFeeFromSignatures(fee, feeManager, txHash);
        }
    }

    function setTotalBurntCoins(uint256 _amount) internal {
        uintStorage[TOTAL_BURNT_COINS] = _amount;
    }

    /**
     * @dev Internal callback to be called on failed message execution due to the out-of-limits error.
     * This function saves the bridge operation information for further processing.
     * @param _recipient address of the receiver where the new coins should be minted.
     * @param _value amount of coins to mint.
     * @param _txHash reference transaction hash on the Foreign side of the bridge which cause this operation.
     * @param _hashMsg unique identifier of the particular bridge operation.
     */
    function onFailedAffirmation(address _recipient, uint256 _value, bytes32 _txHash, bytes32 _hashMsg) internal {
        (address recipient, uint256 value) = txAboveLimits(_hashMsg);
        require(recipient == address(0) && value == 0);
        setOutOfLimitAmount(outOfLimitAmount().add(_value));
        setTxAboveLimits(_recipient, _value, _hashMsg);
        emit AmountLimitExceeded(_recipient, _value, _txHash, _hashMsg);
    }
}
