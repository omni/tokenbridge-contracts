pragma solidity 0.4.24;
import "../../libraries/SafeMath.sol";
import "../../libraries/Message.sol";
import "../BasicBridge.sol";
import "../../upgradeability/EternalStorage.sol";
import "../BasicHomeBridge.sol";
import "./RewardableHomeBridgeNativeToErc.sol";
import "../Sacrifice.sol";


contract HomeBridgeNativeToErc is EternalStorage, BasicBridge, BasicHomeBridge, RewardableHomeBridgeNativeToErc {

    function () public payable {
        require(msg.value > 0);
        require(msg.data.length == 0);
        require(withinLimit(msg.value));
        setTotalSpentPerDay(getCurrentDay(), totalSpentPerDay(getCurrentDay()).add(msg.value));
        uint256 valueToTransfer = msg.value;
        address feeManager = feeManagerContract();
        if (feeManager != address(0)) {
            uint256 fee = calculateFee(valueToTransfer, false, feeManager, HOME_FEE);
            valueToTransfer = valueToTransfer.sub(fee);
        }
        emit UserRequestForSignature(msg.sender, valueToTransfer);
    }

    function initialize (
        address _validatorContract,
        uint256 _dailyLimit,
        uint256 _maxPerTx,
        uint256 _minPerTx,
        uint256 _homeGasPrice,
        uint256 _requiredBlockConfirmations,
        uint256 _foreignDailyLimit,
        uint256 _foreignMaxPerTx,
        address _owner
    ) public returns(bool)
    {
        _initialize(
            _validatorContract,
            _dailyLimit,
            _maxPerTx,
            _minPerTx,
            _homeGasPrice,
            _requiredBlockConfirmations,
            _foreignDailyLimit,
            _foreignMaxPerTx,
            _owner
        );
        setInitialize(true);
        return isInitialized();
    }

    function rewardableInitialize (
        address _validatorContract,
        uint256 _dailyLimit,
        uint256 _maxPerTx,
        uint256 _minPerTx,
        uint256 _homeGasPrice,
        uint256 _requiredBlockConfirmations,
        uint256 _foreignDailyLimit,
        uint256 _foreignMaxPerTx,
        address _owner,
        address _feeManager,
        uint256 _homeFee,
        uint256 _foreignFee
    ) public returns(bool)
    {
        _initialize(
            _validatorContract,
            _dailyLimit,
            _maxPerTx,
            _minPerTx,
            _homeGasPrice,
            _requiredBlockConfirmations,
            _foreignDailyLimit,
            _foreignMaxPerTx,
            _owner
        );
        require(isContract(_feeManager));
        addressStorage[keccak256(abi.encodePacked("feeManagerContract"))] = _feeManager;
        _setFee(_feeManager, _homeFee, HOME_FEE);
        _setFee(_feeManager, _foreignFee, FOREIGN_FEE);
        setInitialize(true);
        return isInitialized();
    }

    function getBridgeMode() public pure returns(bytes4 _data) {
        return bytes4(keccak256(abi.encodePacked("native-to-erc-core")));
    }

    function _initialize (
        address _validatorContract,
        uint256 _dailyLimit,
        uint256 _maxPerTx,
        uint256 _minPerTx,
        uint256 _homeGasPrice,
        uint256 _requiredBlockConfirmations,
        uint256 _foreignDailyLimit,
        uint256 _foreignMaxPerTx,
        address _owner
    ) internal
    {
        require(!isInitialized());
        require(_validatorContract != address(0) && isContract(_validatorContract));
        require(_homeGasPrice > 0);
        require(_requiredBlockConfirmations > 0);
        require(_minPerTx > 0 && _maxPerTx > _minPerTx && _dailyLimit > _maxPerTx);
        require(_foreignMaxPerTx < _foreignDailyLimit);
        require(_owner != address(0));
        addressStorage[keccak256(abi.encodePacked("validatorContract"))] = _validatorContract;
        uintStorage[keccak256(abi.encodePacked("deployedAtBlock"))] = block.number;
        uintStorage[keccak256(abi.encodePacked("dailyLimit"))] = _dailyLimit;
        uintStorage[keccak256(abi.encodePacked("maxPerTx"))] = _maxPerTx;
        uintStorage[keccak256(abi.encodePacked("minPerTx"))] = _minPerTx;
        uintStorage[keccak256(abi.encodePacked("gasPrice"))] = _homeGasPrice;
        uintStorage[keccak256(abi.encodePacked("requiredBlockConfirmations"))] = _requiredBlockConfirmations;
        uintStorage[keccak256(abi.encodePacked("executionDailyLimit"))] = _foreignDailyLimit;
        uintStorage[keccak256(abi.encodePacked("executionMaxPerTx"))] = _foreignMaxPerTx;
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

    function onExecuteAffirmation(address _recipient, uint256 _value, bytes32 txHash) internal returns(bool) {
        setTotalExecutedPerDay(getCurrentDay(), totalExecutedPerDay(getCurrentDay()).add(_value));
        uint256 valueToTransfer = _value;

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

    function affirmationWithinLimits(uint256 _amount) internal view returns(bool) {
        return withinExecutionLimit(_amount);
    }

    function onFailedAffirmation(address _recipient, uint256 _value, bytes32 _txHash) internal {
        revert();
    }
}
