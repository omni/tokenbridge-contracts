pragma solidity 0.4.24;

import "../../libraries/Message.sol";
import "../../upgradeability/EternalStorage.sol";
import "../../interfaces/IBurnableMintableERC677Token.sol";
import "../BasicHomeBridge.sol";
import "../HomeOverdrawManagement.sol";
import "./RewardableHomeBridgeErcToErc.sol";
import "../ERC677BridgeForBurnableMintableToken.sol";

/**
 * @title HomeBridgeErcToErc
 * @dev This contract Home side logic for the erc-to-erc vanilla bridge mode.
 * It is designed to be used as an implementation contract of EternalStorageProxy contract.
 */
contract HomeBridgeErcToErc is
    EternalStorage,
    BasicHomeBridge,
    ERC677BridgeForBurnableMintableToken,
    HomeOverdrawManagement,
    RewardableHomeBridgeErcToErc
{
    function initialize(
        address _validatorContract,
        uint256[3] _dailyLimitMaxPerTxMinPerTxArray, // [ 0 = _dailyLimit, 1 = _maxPerTx, 2 = _minPerTx ]
        uint256 _homeGasPrice,
        uint256 _requiredBlockConfirmations,
        address _erc677token,
        uint256[2] _foreignDailyLimitForeignMaxPerTxArray, // [ 0 = _foreignDailyLimit, 1 = _foreignMaxPerTx ]
        address _owner,
        int256 _decimalShift
    ) external onlyRelevantSender returns (bool) {
        _initialize(
            _validatorContract,
            _dailyLimitMaxPerTxMinPerTxArray,
            _homeGasPrice,
            _requiredBlockConfirmations,
            _erc677token,
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
        address _erc677token,
        uint256[2] _foreignDailyLimitForeignMaxPerTxArray, // [ 0 = _foreignDailyLimit, 1 = _foreignMaxPerTx ]
        address _owner,
        address _feeManager,
        uint256[2] _homeFeeForeignFeeArray, // [ 0 = _homeFee, 1 = _foreignFee ]
        int256 _decimalShift
    ) external onlyRelevantSender returns (bool) {
        _rewardableInitialize(
            _validatorContract,
            _dailyLimitMaxPerTxMinPerTxArray,
            _homeGasPrice,
            _requiredBlockConfirmations,
            _erc677token,
            _foreignDailyLimitForeignMaxPerTxArray,
            _owner,
            _feeManager,
            _homeFeeForeignFeeArray,
            _decimalShift
        );
        setInitialize();

        return isInitialized();
    }

    function _rewardableInitialize(
        address _validatorContract,
        uint256[3] _dailyLimitMaxPerTxMinPerTxArray, // [ 0 = _dailyLimit, 1 = _maxPerTx, 2 = _minPerTx ]
        uint256 _homeGasPrice,
        uint256 _requiredBlockConfirmations,
        address _erc677token,
        uint256[2] _foreignDailyLimitForeignMaxPerTxArray, // [ 0 = _foreignDailyLimit, 1 = _foreignMaxPerTx ]
        address _owner,
        address _feeManager,
        uint256[2] _homeFeeForeignFeeArray, // [ 0 = _homeFee, 1 = _foreignFee ]
        int256 _decimalShift
    ) internal {
        _initialize(
            _validatorContract,
            _dailyLimitMaxPerTxMinPerTxArray,
            _homeGasPrice,
            _requiredBlockConfirmations,
            _erc677token,
            _foreignDailyLimitForeignMaxPerTxArray,
            _owner,
            _decimalShift
        );
        require(AddressUtils.isContract(_feeManager));
        addressStorage[FEE_MANAGER_CONTRACT] = _feeManager;
        _setFee(_feeManager, _homeFeeForeignFeeArray[0], HOME_FEE);
        _setFee(_feeManager, _homeFeeForeignFeeArray[1], FOREIGN_FEE);
    }

    function _initialize(
        address _validatorContract,
        uint256[3] _dailyLimitMaxPerTxMinPerTxArray, // [ 0 = _dailyLimit, 1 = _maxPerTx, 2 = _minPerTx ]
        uint256 _homeGasPrice,
        uint256 _requiredBlockConfirmations,
        address _erc677token,
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
        setErc677token(_erc677token);
    }

    /**
     * @dev Withdraws erc20 tokens or native coins from the token contract. It is required since the bridge contract is the owner of the token contract.
     * @param _token address of the claimed token or address(0) for native coins.
     * @param _to address of the tokens/coins receiver.
     */
    function claimTokensFromErc677(address _token, address _to) external onlyIfUpgradeabilityOwner {
        IBurnableMintableERC677Token(erc677token()).claimTokens(_token, _to);
    }

    function getBridgeMode() external pure returns (bytes4 _data) {
        return 0xba4690f5; // bytes4(keccak256(abi.encodePacked("erc-to-erc-core")))
    }

    /**
     * @dev Internal callback to be called on successfull message execution.
     * Should be called only after enough affirmations from the validators are already collected.
     * @param _recipient address of the receiver where the new tokens should be minted.
     * @param _value amount of tokens to mint.
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
        uint256 valueToMint = _shiftValue(_value);
        address feeManager = feeManagerContract();
        if (feeManager != address(0)) {
            uint256 fee = calculateFee(valueToMint, false, feeManager, FOREIGN_FEE);
            distributeFeeFromAffirmation(fee, feeManager, _txHash);
            valueToMint = valueToMint.sub(fee);
        }
        return IBurnableMintableERC677Token(erc677token()).mint(_recipient, valueToMint);
    }

    function fireEventOnTokenTransfer(address _from, uint256 _value) internal {
        uint256 valueToTransfer = _value;
        address feeManager = feeManagerContract();
        if (feeManager != address(0)) {
            uint256 fee = calculateFee(valueToTransfer, false, feeManager, HOME_FEE);
            valueToTransfer = valueToTransfer.sub(fee);
        }
        emit UserRequestForSignature(_from, valueToTransfer);
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
     * @dev Internal callback to be called on failed message execution due to the out-of-limits error.
     * This function saves the bridge operation information for further processing.
     * @param _recipient address of the receiver where the new tokens should be minted.
     * @param _value amount of tokens to mint.
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
