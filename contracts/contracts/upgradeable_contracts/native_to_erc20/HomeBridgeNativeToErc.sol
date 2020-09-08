pragma solidity 0.4.24;

import "../../libraries/Message.sol";
import "../../upgradeability/EternalStorage.sol";
import "../BasicHomeBridge.sol";
import "./RewardableHomeBridgeNativeToErc.sol";
import "../../libraries/Address.sol";

contract HomeBridgeNativeToErc is EternalStorage, BasicHomeBridge, RewardableHomeBridgeNativeToErc {
    function() public payable {
        require(msg.data.length == 0);
        nativeTransfer(msg.sender);
    }

    function nativeTransfer(address _receiver) internal {
        require(msg.value > 0);
        require(withinLimit(msg.value));
        addTotalSpentPerDay(getCurrentDay(), msg.value);
        uint256 valueToTransfer = msg.value;
        address feeManager = feeManagerContract();
        if (feeManager != address(0)) {
            uint256 fee = calculateFee(valueToTransfer, false, feeManager, HOME_FEE);
            valueToTransfer = valueToTransfer.sub(fee);
        }
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
        uint256[2] _foreignDailyLimitForeignMaxPerTxArray, // [ 0 = _foreignDailyLimit, 1 = _foreignMaxPerTx ]
        address _owner,
        int256 _decimalShift
    ) external onlyRelevantSender returns (bool) {
        _initialize(
            _validatorContract,
            _dailyLimitMaxPerTxMinPerTxArray,
            _homeGasPrice,
            _requiredBlockConfirmations,
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
        return 0x92a8d7fe; // bytes4(keccak256(abi.encodePacked("native-to-erc-core")))
    }

    function _initialize(
        address _validatorContract,
        uint256[3] _dailyLimitMaxPerTxMinPerTxArray, // [ 0 = _dailyLimit, 1 = _maxPerTx, 2 = _minPerTx ]
        uint256 _homeGasPrice,
        uint256 _requiredBlockConfirmations,
        uint256[2] _foreignDailyLimitForeignMaxPerTxArray, // [ 0 = _foreignDailyLimit, 1 = _foreignMaxPerTx ]
        address _owner,
        int256 _decimalShift
    ) internal {
        require(!isInitialized());
        require(AddressUtils.isContract(_validatorContract));
        require(_owner != address(0));

        addressStorage[VALIDATOR_CONTRACT] = _validatorContract;
        uintStorage[DEPLOYED_AT_BLOCK] = block.number;
        _setLimits(_dailyLimitMaxPerTxMinPerTxArray);
        _setGasPrice(_homeGasPrice);
        _setRequiredBlockConfirmations(_requiredBlockConfirmations);
        _setExecutionLimits(_foreignDailyLimitForeignMaxPerTxArray);
        _setDecimalShift(_decimalShift);
        setOwner(_owner);
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
            if (fee != 0) {
                distributeFeeFromSignatures(fee, feeManager, txHash);
            }
        }
    }

    function onExecuteAffirmation(
        address _recipient,
        uint256 _value,
        bytes32 txHash
    ) internal returns (bool) {
        addTotalExecutedPerDay(getCurrentDay(), _value);
        uint256 valueToTransfer = _shiftValue(_value);

        address feeManager = feeManagerContract();
        if (feeManager != address(0)) {
            uint256 fee = calculateFee(valueToTransfer, false, feeManager, FOREIGN_FEE);
            distributeFeeFromAffirmation(fee, feeManager, txHash);
            valueToTransfer = valueToTransfer.sub(fee);
        }

        Address.safeSendValue(_recipient, valueToTransfer);
        return true;
    }

    function onFailedAffirmation(
        address, /*_recipient*/
        uint256, /*_value*/
        bytes32 /*_txHash*/
    ) internal {
        revert();
    }

    /**
     * @dev Internal function for updating fallback gas price value.
     * @param _gasPrice new value for the gas price, zero gas price is not allowed.
     */
    function _setGasPrice(uint256 _gasPrice) internal {
        require(_gasPrice > 0);
        super._setGasPrice(_gasPrice);
    }
}
