pragma solidity 0.4.21;
import "../libraries/SafeMath.sol";
import "../libraries/Helpers.sol";
import "../libraries/Message.sol";
import "./U_Validatable.sol";
import "../upgradeability/EternalStorage.sol";


contract HomeBridge is EternalStorage, Validatable {
    using SafeMath for uint256;
    event GasConsumptionLimitsUpdated(uint256 gas);
    event Deposit (address recipient, uint256 value);
    event Withdraw (address recipient, uint256 value, bytes32 transactionHash);
    event DailyLimit(uint256 newLimit);

    function initialize (
        address _validatorContract,
        uint256 _homeDailyLimit,
        uint256 _maxPerTx,
        uint256 _minPerTx
    ) public
      returns(bool)
    {
        require(!isInitialized());
        require(_validatorContract != address(0));
        require(_minPerTx > 0 && _maxPerTx > _minPerTx && _homeDailyLimit > _maxPerTx);
        addressStorage[keccak256("validatorContract")] = _validatorContract;
        uintStorage[keccak256("deployedAtBlock")] = block.number;
        uintStorage[keccak256("homeDailyLimit")] = _homeDailyLimit;
        uintStorage[keccak256("maxPerTx")] = _maxPerTx;
        uintStorage[keccak256("minPerTx")] = _minPerTx;
        setInitialize(true);
        return isInitialized();
    }

    function () public payable {
        require(msg.value > 0);
        require(withinLimit(msg.value));
        setTotalSpentPerDay(getCurrentDay(), totalSpentPerDay(getCurrentDay()).add(msg.value));
        emit Deposit(msg.sender, msg.value);
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
        emit GasConsumptionLimitsUpdated(_gas);
    }

    function withdraw(uint8[] vs, bytes32[] rs, bytes32[] ss, bytes message) public {
        require(message.length == 116);
        require(Helpers.hasEnoughValidSignatures(message, vs, rs, ss, validatorContract()));

        address recipient = Message.getRecipient(message);
        uint256 value = Message.getValue(message);
        bytes32 hash = Message.getTransactionHash(message);
        require(!withdraws(hash));
        setWithdraws(hash, true);

        // pay out recipient
        recipient.transfer(value);

        emit Withdraw(recipient, value, hash);
    }

    function setHomeDailyLimit(uint256 _homeDailyLimit) public onlyOwner {
        uintStorage[keccak256("homeDailyLimit")] = _homeDailyLimit;
        emit DailyLimit(_homeDailyLimit);
    }

    function setMaxPerTx(uint256 _maxPerTx) public onlyOwner {
        require(_maxPerTx < homeDailyLimit());
        uintStorage[keccak256("maxPerTx")] = _maxPerTx;
    }

    function setMinPerTx(uint256 _minPerTx) public onlyOwner {
        require(_minPerTx < homeDailyLimit() && _minPerTx < maxPerTx());
        uintStorage[keccak256("minPerTx")] = _minPerTx;
    }

    function minPerTx() public view returns(uint256) {
        return uintStorage[keccak256("minPerTx")];
    }

    function getCurrentDay() public view returns(uint256) {
        return now / 1 days;
    }

    function maxPerTx() public view returns(uint256) {
        return uintStorage[keccak256("maxPerTx")];
    }

    function withinLimit(uint256 _amount) public view returns(bool) {
        uint256 nextLimit = totalSpentPerDay(getCurrentDay()).add(_amount);
        return homeDailyLimit() >= nextLimit && _amount <= maxPerTx() && _amount >= minPerTx();
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
