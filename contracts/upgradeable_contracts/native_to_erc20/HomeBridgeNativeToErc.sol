pragma solidity 0.4.24;

import "../../libraries/Message.sol";
import "../../upgradeability/EternalStorage.sol";
import "../BasicHomeBridge.sol";
import "./RewardableHomeBridgeNativeToErc.sol";
import "../../libraries/Address.sol";

/**
 * @title HomeBridgeNativeToErc
 * @dev This contract Home side logic for the native-to-erc vanilla bridge mode.
 * It is designed to be used as an implementation contract of EternalStorageProxy contract.
 */
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

    /**
    * @dev Allows to transfer any locked token on this contract that is not part of the bridge operations.
    * Native tokens are not allowed to be claimed.
    * @param _token address of the token.
    * @param _to address that will receive the locked tokens on this contract.
    */
    function claimTokens(address _token, address _to) external onlyIfUpgradeabilityOwner {
        // Since bridged coins are locked at this contract, it is not allowed to claim them with the use of claimTokens function
        require(_token != address(0));
        claimValues(_token, _to);
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

        addressStorage[VALIDATOR_CONTRACT] = _validatorContract;
        uintStorage[DEPLOYED_AT_BLOCK] = block.number;
        _setLimits(_dailyLimitMaxPerTxMinPerTxArray);
        _setGasPrice(_homeGasPrice);
        _setRequiredBlockConfirmations(_requiredBlockConfirmations);
        _setExecutionLimits(_foreignDailyLimitForeignMaxPerTxArray);
        _setDecimalShift(_decimalShift);
        _setOwner(_owner);
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

    /**
     * @dev Internal callback to be called on successfull message execution.
     * Should be called only after enough affirmations from the validators are already collected.
     * @param _recipient address of the receiver where the new coins should be unlocked.
     * @param _value amount of coins to unlock.
     * @param _txHash reference transaction hash on the Foreign side of the bridge which cause this operation.
     * @param _hashMsg unique identifier of the particular bridge operation.
     * Not used in this bridge mode, but required for interface unification with other bridge modes.
     * @return true, if execution completed successfully.
     */
    function onExecuteAffirmation(address _recipient, uint256 _value, bytes32 _txHash, bytes32 _hashMsg)
        internal
        returns (bool)
    {
        addTotalExecutedPerDay(getCurrentDay(), _value);
        uint256 valueToTransfer = _shiftValue(_value);

        address feeManager = feeManagerContract();
        if (feeManager != address(0)) {
            uint256 fee = calculateFee(valueToTransfer, false, feeManager, FOREIGN_FEE);
            distributeFeeFromAffirmation(fee, feeManager, _txHash);
            valueToTransfer = valueToTransfer.sub(fee);
        }

        Address.safeSendValue(_recipient, valueToTransfer);
        return true;
    }

    /**
     * @dev Internal callback to be called on failed message execution due to the out-of-limits error.
     * This function saves the bridge operation information for further processing.
     * @param _recipient address of the receiver where the new coins should be unlocked.
     * @param _value amount of coins to unlock.
     * @param _txHash reference transaction hash on the Foreign side of the bridge which cause this operation.
     * @param _hashMsg unique identifier of the particular bridge operation.
     */
    function onFailedAffirmation(address _recipient, uint256 _value, bytes32 _txHash, bytes32 _hashMsg) internal {
        // solhint-disable-previous-line no-unused-vars
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
