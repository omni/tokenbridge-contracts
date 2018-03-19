pragma solidity ^0.4.19;
import "../libraries/SafeMath.sol";
import "../libraries/Helpers.sol";
import "../libraries/Message.sol";
// import "./IBridgeValidators.sol";
// import "./Validatable.sol";
// import "./BridgeDeploymentAddressStorage.sol";
import "./U_Validatable.sol";
import "../upgradeability/OwnedUpgradeabilityStorage.sol";


contract HomeBridge is OwnedUpgradeabilityStorage, Validatable {
    using SafeMath for uint256;
    event GasConsumptionLimitsUpdated(uint256 gas);
    event Deposit (address recipient, uint256 value);
    event Withdraw (address recipient, uint256 value, bytes32 transactionHash);
    event DailyLimit(uint256 newLimit);

    function initialize (
        address _validatorContract,
        uint256 _homeDailyLimit
    ) public {
        require(!isInitialized());
        require(_validatorContract != address(0));
        require(_homeDailyLimit > 0);
        addressStorage[keccak256("validatorContract")] = _validatorContract;
        uintStorage[keccak256("deployedAtBlock")] = block.number;
        setHomeDailyLimit(_homeDailyLimit);
        setInitialize(true);
    }

    function () public payable {
        require(msg.value > 0);
        require(withinLimit(msg.value));
        setTotalSpentPerDay(getCurrentDay(), totalSpentPerDay(getCurrentDay()).add(msg.value));
        Deposit(msg.sender, msg.value);
    }

    function gasLimitWithdrawRelay() public view returns(uint256) {
        return uintStorage[keccak256("gasLimitWithdrawRelay")];
    }

    function deployedAtBlock() public view returns(uint256) {
        return uintStorage[keccak256("deployedAtBlock")];
    }

    function homeDailyLimit() public view returns(uint256) {
        return uintStorage[keccak256("homeDailyLimit")];
    }

    function totalSpentPerDay(uint256 _day) public view returns(uint256) {
        return uintStorage[keccak256("totalSpentPerDay", _day)];
    }

    function withdraws(bytes32 _withdraw) public view returns(bool) {
        return boolStorage[keccak256("withdraws", _withdraw)];
    }

    function setGasLimitWithdrawRelay(uint256 _gas) public onlyOwner {
        uintStorage[keccak256("gasLimitWithdrawRelay")] = _gas;
        GasConsumptionLimitsUpdated(_gas);
    }

    function withdraw(uint8[] vs, bytes32[] rs, bytes32[] ss, bytes message) public {
        require(message.length == 116);
        require(Helpers.hasEnoughValidSignatures(message, vs, rs, ss, validatorContract()));

        address recipient = Message.getRecipient(message);
        uint256 value = Message.getValue(message);
        bytes32 hash = Message.getTransactionHash(message);
        require(!withdraws(hash));
        // Order of operations below is critical to avoid TheDAO-like re-entry bug
        setWithdraws(hash, true);

        // pay out recipient
        recipient.transfer(value);

        Withdraw(recipient, value, hash);
    }

    function setHomeDailyLimit(uint256 _homeDailyLimit) public onlyOwner {
        uintStorage[keccak256("homeDailyLimit")] = _homeDailyLimit;
        DailyLimit(_homeDailyLimit);
    }

    function getCurrentDay() public view returns(uint256) {
        return now / 1 days;
    }

    function withinLimit(uint256 _amount) public view returns(bool) {
        uint256 nextLimit = totalSpentPerDay(getCurrentDay()).add(_amount);
        return homeDailyLimit() >= nextLimit;
    }

    function isInitialized() public view returns(bool) {
        return boolStorage[keccak256("isInitialized")];
    }

    function setTotalSpentPerDay(uint256 _day, uint256 _value) private {
        uintStorage[keccak256("totalSpentPerDay", _day)] = _value;
    }

    function setWithdraws(bytes32 _withdraw, bool _status) private {
        boolStorage[keccak256("withdraws", _withdraw)] = _status;
    }

    function setInitialize(bool _status) private {
        boolStorage[keccak256("isInitialized")] = _status;
    }
}
