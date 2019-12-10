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
        // absolute: [ 0 = _dailyLimit, 1 = _maxPerTx, 2 = _minPerTx ]
        // relative: [ 0 = _targetLimit, 1 = _threshold, 2 = _maxPerTx, 3 = _minPerTx ]
        uint256[] _requestLimitsArray,
        uint256 _homeGasPrice,
        uint256 _requiredBlockConfirmations,
        address _erc677token,
        uint256[] _executionLimitsArray, // [ 0 = _executionDailyLimit, 1 = _executionMaxPerTx, 2 = _executionMinPerTx ]
        address _owner,
        uint256 _decimalShift,
        address _limitsContract
    ) public returns (bool) {
        require(!isInitialized());
        require(AddressUtils.isContract(_validatorContract));
        require(_requiredBlockConfirmations > 0);
        require(_owner != address(0));
        require(AddressUtils.isContract(_limitsContract));

        addressStorage[VALIDATOR_CONTRACT] = _validatorContract;
        uintStorage[DEPLOYED_AT_BLOCK] = block.number;
        uintStorage[GAS_PRICE] = _homeGasPrice;
        uintStorage[REQUIRED_BLOCK_CONFIRMATIONS] = _requiredBlockConfirmations;
        uintStorage[DECIMAL_SHIFT] = _decimalShift;
        setOwner(_owner);
        setErc677token(_erc677token);
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
        address _erc677token,
        uint256[] _executionLimitsArray, // [ 0 = _executionDailyLimit, 1 = _executionMaxPerTx, 2 = _executionMinPerTx ]
        address _owner,
        address _feeManager,
        uint256[] _homeFeeForeignFeeArray, // [ 0 = _homeFee, 1 = _foreignFee ]
        uint256 _decimalShift,
        address _limitsContract
    ) public returns (bool) {
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
                _erc677token,
                _executionLimitsArray,
                _owner,
                _decimalShift,
                _limitsContract
            );
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

    function _getTokenBalance() internal view returns (uint256) {
        return erc677token().totalSupply();
    }
}
