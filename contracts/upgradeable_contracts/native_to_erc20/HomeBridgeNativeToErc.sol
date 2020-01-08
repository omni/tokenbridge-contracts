pragma solidity 0.4.24;

import "../../libraries/Message.sol";
import "../../upgradeability/EternalStorage.sol";
import "../BasicHomeBridge.sol";
import "./RewardableHomeBridgeNativeToErc.sol";
import "../Sacrifice.sol";

contract HomeBridgeNativeToErc is EternalStorage, BasicHomeBridge, RewardableHomeBridgeNativeToErc {
    function() public payable {
        require(msg.data.length == 0);
        nativeTransfer(msg.sender);
    }

    function nativeTransfer(address _receiver) internal {
        require(msg.value > 0);
        _updateTodayLimit();
        require(withinLimit(msg.value));
        _increaseTotalSpentPerDay(msg.value);
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
        uint256[] _requestLimitsArray, // [ 0 = _dailyLimit, 1 = _maxPerTx, 2 = _minPerTx ]
        uint256 _homeGasPrice,
        uint256 _requiredBlockConfirmations,
        // absolute: [ 0 = _executionDailyLimit, 1 = _executionMaxPerTx, 2 = _executionMinPerTx ]
        // relative: [ 0 = _targetLimit, 1 = _threshold, 2 = _executionMaxPerTx, 3 = _executionMinPerTx ]
        uint256[] _executionLimitsArray,
        address _owner,
        uint256 _decimalShift,
        address _limitsContract
    ) public onlyRelevantSender returns (bool) {
        require(AddressUtils.isContract(_limitsContract));
        addressStorage[LIMITS_CONTRACT] = _limitsContract;
        _setLimits(_requestLimitsArray, _executionLimitsArray);
        _initialize(_validatorContract, _homeGasPrice, _requiredBlockConfirmations, _owner, _decimalShift);
        setInitialize();
        return isInitialized();
    }

    function rewardableInitialize(
        address _validatorContract,
        uint256[] _requestLimitsArray, // [ 0 = _dailyLimit, 1 = _maxPerTx, 2 = _minPerTx ]
        uint256 _homeGasPrice,
        uint256 _requiredBlockConfirmations,
        // absolute: [ 0 = _executionDailyLimit, 1 = _executionMaxPerTx, 2 = _executionMinPerTx ]
        // relative: [ 0 = _targetLimit, 1 = _threshold, 2 = _executionMaxPerTx, 3 = _executionMinPerTx ]
        uint256[] _executionLimitsArray,
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
                _executionLimitsArray,
                _owner,
                _decimalShift,
                _limitsContract
            );
    }

    function getBridgeMode() external pure returns (bytes4 _data) {
        return 0x92a8d7fe; // bytes4(keccak256(abi.encodePacked("native-to-erc-core")))
    }

    function _initialize(
        address _validatorContract,
        uint256 _homeGasPrice,
        uint256 _requiredBlockConfirmations,
        address _owner,
        uint256 _decimalShift
    ) internal {
        require(!isInitialized());
        require(AddressUtils.isContract(_validatorContract));
        require(_homeGasPrice > 0);
        require(_requiredBlockConfirmations > 0);
        require(_owner != address(0));

        addressStorage[VALIDATOR_CONTRACT] = _validatorContract;
        uintStorage[DEPLOYED_AT_BLOCK] = block.number;
        uintStorage[GAS_PRICE] = _homeGasPrice;
        uintStorage[REQUIRED_BLOCK_CONFIRMATIONS] = _requiredBlockConfirmations;
        uintStorage[DECIMAL_SHIFT] = _decimalShift;
        setOwner(_owner);

        emit RequiredBlockConfirmationChanged(_requiredBlockConfirmations);
        emit GasPriceChanged(_homeGasPrice);
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

    function onExecuteAffirmation(address _recipient, uint256 _value, bytes32 txHash) internal returns (bool) {
        _increaseTotalExecutedPerDay(_value);
        uint256 valueToTransfer = _value.mul(10**decimalShift());

        address feeManager = feeManagerContract();
        if (feeManager != address(0)) {
            uint256 fee = calculateFee(valueToTransfer, false, feeManager, FOREIGN_FEE);
            distributeFeeFromAffirmation(fee, feeManager, txHash);
            valueToTransfer = valueToTransfer.sub(fee);
        }

        if (!_recipient.send(valueToTransfer)) {
            (new Sacrifice).value(valueToTransfer)(_recipient);
        }
        return true;
    }

    function onFailedAffirmation(
        address, /*_recipient*/
        uint256, /*_value*/
        bytes32 /*_txHash*/
    ) internal {
        revert();
    }

    function _getTokenBalance() internal view returns (uint256) {
        return address(this).balance;
    }
}
