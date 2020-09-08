pragma solidity 0.4.24;

import "../../interfaces/IBurnableMintableERC677Token.sol";
import "../BasicForeignBridge.sol";
import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import "../ERC677BridgeForBurnableMintableToken.sol";
import "./RewardableForeignBridgeNativeToErc.sol";

contract ForeignBridgeNativeToErc is
    BasicForeignBridge,
    ERC677BridgeForBurnableMintableToken,
    RewardableForeignBridgeNativeToErc
{
    function initialize(
        address _validatorContract,
        address _erc677token,
        uint256[3] _dailyLimitMaxPerTxMinPerTxArray, // [ 0 = _dailyLimit, 1 = _maxPerTx, 2 = _minPerTx ]
        uint256 _foreignGasPrice,
        uint256 _requiredBlockConfirmations,
        uint256[2] _homeDailyLimitHomeMaxPerTxArray, // [ 0 = _homeDailyLimit, 1 = _homeMaxPerTx ]
        address _owner,
        int256 _decimalShift,
        address _bridgeOnOtherSide
    ) external onlyRelevantSender returns (bool) {
        _initialize(
            _validatorContract,
            _erc677token,
            _dailyLimitMaxPerTxMinPerTxArray,
            _foreignGasPrice,
            _requiredBlockConfirmations,
            _homeDailyLimitHomeMaxPerTxArray,
            _owner,
            _decimalShift,
            _bridgeOnOtherSide
        );
        setInitialize();
        return isInitialized();
    }

    function rewardableInitialize(
        address _validatorContract,
        address _erc677token,
        uint256[3] _dailyLimitMaxPerTxMinPerTxArray, // [ 0 = _dailyLimit, 1 = _maxPerTx, 2 = _minPerTx ]
        uint256 _foreignGasPrice,
        uint256 _requiredBlockConfirmations,
        uint256[2] _homeDailyLimitHomeMaxPerTxArray, // [ 0 = _homeDailyLimit, 1 = _homeMaxPerTx ]
        address _owner,
        address _feeManager,
        uint256 _homeFee,
        int256 _decimalShift,
        address _bridgeOnOtherSide
    ) external onlyRelevantSender returns (bool) {
        _initialize(
            _validatorContract,
            _erc677token,
            _dailyLimitMaxPerTxMinPerTxArray,
            _foreignGasPrice,
            _requiredBlockConfirmations,
            _homeDailyLimitHomeMaxPerTxArray,
            _owner,
            _decimalShift,
            _bridgeOnOtherSide
        );
        require(AddressUtils.isContract(_feeManager));
        addressStorage[FEE_MANAGER_CONTRACT] = _feeManager;
        _setFee(_feeManager, _homeFee, HOME_FEE);
        setInitialize();
        return isInitialized();
    }

    function getBridgeMode() external pure returns (bytes4 _data) {
        return 0x92a8d7fe; // bytes4(keccak256(abi.encodePacked("native-to-erc-core")))
    }

    function claimTokensFromErc677(address _token, address _to) external onlyIfUpgradeabilityOwner {
        IBurnableMintableERC677Token(erc677token()).claimTokens(_token, _to);
    }

    function _initialize(
        address _validatorContract,
        address _erc677token,
        uint256[3] _dailyLimitMaxPerTxMinPerTxArray, // [ 0 = _dailyLimit, 1 = _maxPerTx, 2 = _minPerTx ]
        uint256 _foreignGasPrice,
        uint256 _requiredBlockConfirmations,
        uint256[2] _homeDailyLimitHomeMaxPerTxArray, // [ 0 = _homeDailyLimit, 1 = _homeMaxPerTx ]
        address _owner,
        int256 _decimalShift,
        address _bridgeOnOtherSide
    ) internal {
        require(!isInitialized());
        require(AddressUtils.isContract(_validatorContract));
        require(_owner != address(0));

        addressStorage[VALIDATOR_CONTRACT] = _validatorContract;
        setErc677token(_erc677token);
        _setLimits(_dailyLimitMaxPerTxMinPerTxArray);
        uintStorage[DEPLOYED_AT_BLOCK] = block.number;
        _setGasPrice(_foreignGasPrice);
        _setRequiredBlockConfirmations(_requiredBlockConfirmations);
        _setExecutionLimits(_homeDailyLimitHomeMaxPerTxArray);
        _setDecimalShift(_decimalShift);
        setOwner(_owner);
        _setBridgeContractOnOtherSide(_bridgeOnOtherSide);
    }

    function onExecuteMessage(
        address _recipient,
        uint256 _amount,
        bytes32 _txHash
    ) internal returns (bool) {
        addTotalExecutedPerDay(getCurrentDay(), _amount);
        uint256 valueToMint = _unshiftValue(_amount);
        address feeManager = feeManagerContract();
        if (feeManager != address(0)) {
            uint256 fee = calculateFee(valueToMint, false, feeManager, HOME_FEE);
            if (fee != 0) {
                distributeFeeFromSignatures(fee, feeManager, _txHash);
                valueToMint = valueToMint.sub(fee);
            }
        }
        return IBurnableMintableERC677Token(erc677token()).mint(_recipient, valueToMint);
    }

    function fireEventOnTokenTransfer(address _from, uint256 _value) internal {
        emit UserRequestForAffirmation(_from, _value);
    }

    function onFailedMessage(
        address,
        uint256,
        bytes32
    ) internal {
        revert();
    }
}
