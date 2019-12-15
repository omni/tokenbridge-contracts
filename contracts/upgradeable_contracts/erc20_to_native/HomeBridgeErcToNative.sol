pragma solidity 0.4.24;

import "../../libraries/Message.sol";
import "../../upgradeability/EternalStorage.sol";
import "../../interfaces/IBlockReward.sol";
import "../BasicHomeBridge.sol";
import "../OverdrawManagement.sol";
import "./RewardableHomeBridgeErcToNative.sol";
import "../BlockRewardBridge.sol";

contract HomeBridgeErcToNative is
    EternalStorage,
    BasicHomeBridge,
    OverdrawManagement,
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
        _updateTodayLimit();
        require(withinLimit(msg.value));
        IBlockReward blockReward = blockRewardContract();
        uint256 totalMinted = blockReward.mintedTotallyByBridge(address(this));
        uint256 totalBurnt = totalBurntCoins();
        require(msg.value <= totalMinted.sub(totalBurnt));
        _increaseTotalSpentPerDay(msg.value);
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
        // absolute: [ 0 = _dailyLimit, 1 = _maxPerTx, 2 = _minPerTx ]
        // relative: [ 0 = _targetLimit, 1 = _threshold, 2 = _maxPerTx, 3 = _minPerTx ]
        uint256[] _requestLimitsArray,
        uint256 _homeGasPrice,
        uint256 _requiredBlockConfirmations,
        address _blockReward,
        uint256[] _executionLimitsArray, // [ 0 = _executionDailyLimit, 1 = _executionMaxPerTx, 2 = _executionMinPerTx ]
        address _owner,
        uint256 _decimalShift,
        address _limitsContract
    ) public returns (bool) {
        require(!isInitialized());
        require(AddressUtils.isContract(_validatorContract));
        require(_requiredBlockConfirmations > 0);
        require(_blockReward == address(0) || AddressUtils.isContract(_blockReward));
        require(_owner != address(0));
        require(AddressUtils.isContract(_limitsContract));

        addressStorage[VALIDATOR_CONTRACT] = _validatorContract;
        uintStorage[DEPLOYED_AT_BLOCK] = block.number;
        uintStorage[GAS_PRICE] = _homeGasPrice;
        uintStorage[REQUIRED_BLOCK_CONFIRMATIONS] = _requiredBlockConfirmations;
        addressStorage[BLOCK_REWARD_CONTRACT] = _blockReward;
        uintStorage[DECIMAL_SHIFT] = _decimalShift;
        setOwner(_owner);
        addressStorage[LIMITS_CONTRACT] = _limitsContract;
        _setLimits(_requestLimitsArray, _executionLimitsArray);

        emit RequiredBlockConfirmationChanged(_requiredBlockConfirmations);
        emit GasPriceChanged(_homeGasPrice);

        setInitialize();
        return isInitialized();
    }

    function rewardableInitialize(
        address _validatorContract,
        // absolute: [ 0 = _dailyLimit, 1 = _maxPerTx, 2 = _minPerTx ]
        // relative: [ 0 = _targetLimit, 1 = _threshold, 2 = _maxPerTx, 3 = _minPerTx ]
        uint256[] _requestLimitsArray,
        uint256 _homeGasPrice,
        uint256 _requiredBlockConfirmations,
        address _blockReward,
        uint256[] _executionLimitsArray, // [ 0 = _executionDailyLimit, 1 = _executionMaxPerTx, 2 = _executionMinPerTx ]
        address _owner,
        address _feeManager,
        uint256[] _homeFeeForeignFeeArray, // [ 0 = _homeFee, 1 = _foreignFee ]
        uint256 _decimalShift,
        address _limitsContract
    ) external returns (bool) {
        require(AddressUtils.isContract(_feeManager));
        addressStorage[FEE_MANAGER_CONTRACT] = _feeManager;
        _setFee(_feeManager, _homeFeeForeignFeeArray[0], HOME_FEE);
        _setFee(_feeManager, _homeFeeForeignFeeArray[1], FOREIGN_FEE);
        return
            initialize(
                _validatorContract,
                _requestLimitsArray,
                _homeGasPrice,
                _requiredBlockConfirmations,
                _blockReward,
                _executionLimitsArray,
                _owner,
                _decimalShift,
                _limitsContract
            );
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

    function onExecuteAffirmation(address _recipient, uint256 _value, bytes32 txHash) internal returns (bool) {
        _increaseTotalExecutedPerDay(_value);
        IBlockReward blockReward = blockRewardContract();
        require(blockReward != address(0));
        uint256 valueToMint = _value.mul(10**decimalShift());
        address feeManager = feeManagerContract();
        if (feeManager != address(0)) {
            uint256 fee = calculateFee(valueToMint, false, feeManager, FOREIGN_FEE);
            distributeFeeFromAffirmation(fee, feeManager, txHash);
            valueToMint = valueToMint.sub(fee);
        }
        blockReward.addExtraReceiver(valueToMint, _recipient);
        return true;
    }

    function onSignaturesCollected(bytes _message) internal {
        address feeManager = feeManagerContract();
        if (feeManager != address(0)) {
            address recipient;
            uint256 amount;
            bytes32 txHash;
            address contractAddress;
            (recipient, amount, txHash, contractAddress) = Message.parseMessage(_message);
            uint256 fee = calculateFee(amount, true, feeManager, HOME_FEE);
            distributeFeeFromSignatures(fee, feeManager, txHash);
        }
    }

    function setTotalBurntCoins(uint256 _amount) internal {
        uintStorage[TOTAL_BURNT_COINS] = _amount;
    }

    function onFailedAffirmation(address _recipient, uint256 _value, bytes32 _txHash) internal {
        address recipient;
        uint256 value;
        (recipient, value) = txAboveLimits(_txHash);
        require(recipient == address(0) && value == 0);
        setOutOfLimitAmount(outOfLimitAmount().add(_value));
        setTxAboveLimits(_recipient, _value, _txHash);
        emit AmountLimitExceeded(_recipient, _value, _txHash);
    }

    function _getTokenBalance() internal view returns (uint256) {
        uint256 totalMinted = blockRewardContract().mintedTotallyByBridge(address(this));
        uint256 totalBurnt = totalBurntCoins();
        return totalMinted.sub(totalBurnt);
    }
}
