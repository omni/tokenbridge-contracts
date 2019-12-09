pragma solidity 0.4.24;

import "../../libraries/Message.sol";
import "../../upgradeability/EternalStorage.sol";
import "../../interfaces/IBurnableMintableERC677Token.sol";
import "../BasicHomeBridge.sol";
import "../OverdrawManagement.sol";
import "./RewardableHomeBridgeErcToErc.sol";
import "../ERC677BridgeForBurnableMintableToken.sol";

contract HomeBridgeErcToErc is
    EternalStorage,
    BasicHomeBridge,
    ERC677BridgeForBurnableMintableToken,
    OverdrawManagement,
    RewardableHomeBridgeErcToErc
{
    function initialize(
        address _validatorContract,
        uint256[] _requestLimitsArray, // [ 0 = _dailyLimit, 1 = _maxPerTx, 2 = _minPerTx ]
        uint256 _homeGasPrice,
        uint256 _requiredBlockConfirmations,
        address _erc677token,
        uint256[] _executionLimitsArray, // [ 0 = _foreignDailyLimit, 1 = _foreignMaxPerTx, 2 = _foreignMinPerTx ]
        address _owner,
        uint256 _decimalShift,
        address _limitsContract
    ) external returns (bool) {
        require(AddressUtils.isContract(_limitsContract));
        addressStorage[LIMITS_CONTRACT] = _limitsContract;
        _setLimits(_requestLimitsArray, _executionLimitsArray);
        _initialize(
            _validatorContract,
            _homeGasPrice,
            _requiredBlockConfirmations,
            _erc677token,
            _owner,
            _decimalShift
        );
        setInitialize();

        return isInitialized();
    }

    function rewardableInitialize(
        address[] _contracts, // [ 0 = _validatorContract, 1 = _erc677token, 2 = _feeManager, 3 = _limitsContract ]
        uint256[] _requestLimitsArray, // [ 0 = _dailyLimit, 1 = _maxPerTx, 2 = _minPerTx ]
        uint256 _homeGasPrice,
        uint256 _requiredBlockConfirmations,
        uint256[] _executionLimitsArray, // [ 0 = _foreignDailyLimit, 1 = _foreignMaxPerTx, 2 = _foreignMinPerTx ]
        address _owner,
        uint256[] _homeFeeForeignFeeArray, // [ 0 = _homeFee, 1 = _foreignFee ]
        uint256 _decimalShift
    ) external returns (bool) {
        require(AddressUtils.isContract(_contracts[3]));
        addressStorage[LIMITS_CONTRACT] = _contracts[3];
        _setLimits(_requestLimitsArray, _executionLimitsArray);
        _rewardableInitialize(
            _contracts,
            _homeGasPrice,
            _requiredBlockConfirmations,
            _owner,
            _homeFeeForeignFeeArray,
            _decimalShift
        );
        setInitialize();

        return isInitialized();
    }

    function _rewardableInitialize(
        address[] _contracts, // [ 0 = _validatorContract, 1 = _erc677token, 2 = _feeManager, 3 = _limitsContract, 4 = _blockReward ]
        uint256 _homeGasPrice,
        uint256 _requiredBlockConfirmations,
        address _owner,
        uint256[] _homeFeeForeignFeeArray, // [ 0 = _homeFee, 1 = _foreignFee ]
        uint256 _decimalShift
    ) internal {
        _initialize(
            _contracts[0],
            _homeGasPrice,
            _requiredBlockConfirmations,
            _contracts[1],
            _owner,
            _decimalShift
        );
        require(AddressUtils.isContract(_contracts[2]));
        addressStorage[FEE_MANAGER_CONTRACT] = _contracts[2];
        _setFee(_contracts[2], _homeFeeForeignFeeArray[0], HOME_FEE);
        _setFee(_contracts[2], _homeFeeForeignFeeArray[1], FOREIGN_FEE);
    }

    function _initialize(
        address _validatorContract,
        uint256 _homeGasPrice,
        uint256 _requiredBlockConfirmations,
        address _erc677token,
        address _owner,
        uint256 _decimalShift
    ) internal {
        require(!isInitialized());
        require(AddressUtils.isContract(_validatorContract));
        require(_requiredBlockConfirmations > 0);
        require(_owner != address(0));
        addressStorage[VALIDATOR_CONTRACT] = _validatorContract;
        uintStorage[DEPLOYED_AT_BLOCK] = block.number;
        uintStorage[GAS_PRICE] = _homeGasPrice;
        uintStorage[REQUIRED_BLOCK_CONFIRMATIONS] = _requiredBlockConfirmations;
        uintStorage[DECIMAL_SHIFT] = _decimalShift;
        setOwner(_owner);
        setErc677token(_erc677token);

        emit RequiredBlockConfirmationChanged(_requiredBlockConfirmations);
        emit GasPriceChanged(_homeGasPrice);
    }

    function claimTokensFromErc677(address _token, address _to) external onlyIfUpgradeabilityOwner {
        IBurnableMintableERC677Token(erc677token()).claimTokens(_token, _to);
    }

    function getBridgeMode() external pure returns (bytes4 _data) {
        return 0xba4690f5; // bytes4(keccak256(abi.encodePacked("erc-to-erc-core")))
    }

    function onExecuteAffirmation(address _recipient, uint256 _value, bytes32 txHash) internal returns (bool) {
        _increaseTotalExecutedPerDay(_value);
        uint256 valueToMint = _value.mul(10**decimalShift());
        address feeManager = feeManagerContract();
        if (feeManager != address(0)) {
            uint256 fee = calculateFee(valueToMint, false, feeManager, FOREIGN_FEE);
            distributeFeeFromAffirmation(fee, feeManager, txHash);
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

    function onFailedAffirmation(address _recipient, uint256 _value, bytes32 _txHash) internal {
        address recipient;
        uint256 value;
        (recipient, value) = txAboveLimits(_txHash);
        require(recipient == address(0) && value == 0);
        setOutOfLimitAmount(outOfLimitAmount().add(_value));
        setTxAboveLimits(_recipient, _value, _txHash);
        emit AmountLimitExceeded(_recipient, _value, _txHash);
    }
}
