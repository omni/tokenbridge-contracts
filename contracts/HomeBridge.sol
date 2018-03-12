pragma solidity ^0.4.19;
import "./libraries/SafeMath.sol";
import "./libraries/Helpers.sol";
import "./libraries/Message.sol";
import "./IBridgeValidators.sol";
import "./Validatable.sol";
import "./BridgeDeploymentAddressStorage.sol";


contract HomeBridge is Validatable, BridgeDeploymentAddressStorage {
    using SafeMath for uint256;
    uint256 public gasLimitWithdrawRelay;
    uint256 public estimatedGasCostOfWithdraw;
    uint256 public homeDailyLimit;
    mapping (uint256 => uint256) totalSpentPerDay;
    mapping (bytes32 => bool) withdraws;

    event GasConsumptionLimitsUpdated(uint256 gas);
    event Deposit (address recipient, uint256 value);
    event Withdraw (address recipient, uint256 value);
    event DailyLimit(uint256 newLimit);

    function HomeBridge (
        address _validatorContract,
        uint256 _homeDailyLimit
    ) public Validatable(_validatorContract) {
        require(_homeDailyLimit > 0);
        homeDailyLimit = _homeDailyLimit;
        DailyLimit(homeDailyLimit);
    }

    /// Should be used to deposit money.
    function () public payable {
        require(msg.value > 0);
        require(withinLimit(msg.value));
        totalSpentPerDay[getCurrentDay()] = totalSpentPerDay[getCurrentDay()].add(msg.value);
        Deposit(msg.sender, msg.value);
    }

    function setGasLimitWithdrawRelay(uint256 _gas) public onlyOwner {
        gasLimitWithdrawRelay = _gas;
        GasConsumptionLimitsUpdated(gasLimitWithdrawRelay);
    }

    function withdraw(uint8[] vs, bytes32[] rs, bytes32[] ss, bytes message) public {
        require(message.length == 116);
        require(Helpers.hasEnoughValidSignatures(message, vs, rs, ss, validatorContract));

        address recipient = Message.getRecipient(message);
        uint256 value = Message.getValue(message);
        bytes32 hash = Message.getTransactionHash(message);
        uint256 homeGasPrice = Message.getHomeGasPrice(message);
        require((recipient == msg.sender) || (tx.gasprice == homeGasPrice));
        require(!withdraws[hash]);
        // Order of operations below is critical to avoid TheDAO-like re-entry bug
        withdraws[hash] = true;

        uint256 estimatedWeiCostOfWithdraw = estimatedGasCostOfWithdraw.mul(homeGasPrice);

        // charge recipient for relay cost
        uint256 valueRemainingAfterSubtractingCost = value.sub(estimatedWeiCostOfWithdraw);

        // pay out recipient
        recipient.transfer(valueRemainingAfterSubtractingCost);

        // refund relay cost to relaying authority
        msg.sender.transfer(estimatedWeiCostOfWithdraw);

        Withdraw(recipient, valueRemainingAfterSubtractingCost);
    }

    function setDailyLimit(uint256 _homeDailyLimit) public onlyOwner {
        require(_homeDailyLimit > 0);
        homeDailyLimit = _homeDailyLimit;
        DailyLimit(homeDailyLimit);
    }

    function getCurrentDay() public view returns(uint256) {
        return now / 1 days;
    }

    function withinLimit(uint256 _amount) public view returns(bool) {
        uint256 nextLimit = totalSpentPerDay[getCurrentDay()].add(_amount);
        return homeDailyLimit >= nextLimit;
    }
}
