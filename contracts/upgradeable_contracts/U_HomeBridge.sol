pragma solidity 0.4.23;
import "../libraries/SafeMath.sol";
import "../libraries/Message.sol";
import "./U_BasicBridge.sol";
import "../upgradeability/EternalStorage.sol";


contract HomeBridge is EternalStorage, BasicBridge {
    using SafeMath for uint256;
    event GasConsumptionLimitsUpdated(uint256 gas);
    event Deposit (address recipient, uint256 value);
    event Withdraw (address recipient, uint256 value, bytes32 transactionHash);
    event DailyLimit(uint256 newLimit);
    event SignedForDeposit(address indexed signer, bytes32 messageHash);
    event CollectedSignatures(address authorityResponsibleForRelay, bytes32 messageHash);


    function initialize (
        address _validatorContract,
        uint256 _homeDailyLimit,
        uint256 _maxPerTx,
        uint256 _minPerTx,
        uint256 _homeGasPrice,
        uint256 _requiredBlockConfirmations
    ) public
      returns(bool)
    {
        require(!isInitialized());
        require(_validatorContract != address(0));
        require(_homeGasPrice > 0);
        require(_requiredBlockConfirmations > 0);
        require(_minPerTx > 0 && _maxPerTx > _minPerTx && _homeDailyLimit > _maxPerTx);
        addressStorage[keccak256("validatorContract")] = _validatorContract;
        uintStorage[keccak256("deployedAtBlock")] = block.number;
        uintStorage[keccak256("homeDailyLimit")] = _homeDailyLimit;
        uintStorage[keccak256("maxPerTx")] = _maxPerTx;
        uintStorage[keccak256("minPerTx")] = _minPerTx;
        uintStorage[keccak256("gasPrice")] = _homeGasPrice;
        uintStorage[keccak256("requiredBlockConfirmations")] = _requiredBlockConfirmations;
        setInitialize(true);
        return isInitialized();
    }

    function () public payable {
        require(msg.value > 0);
        require(msg.data.length == 0);
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

    function setGasLimitWithdrawRelay(uint256 _gas) external onlyOwner {
        uintStorage[keccak256("gasLimitWithdrawRelay")] = _gas;
        emit GasConsumptionLimitsUpdated(_gas);
    }

    function withdraw(address recipient, uint256 value, bytes32 transactionHash) external onlyValidator {
        bytes32 hashMsg = keccak256(recipient, value, transactionHash);
        bytes32 hashSender = keccak256(msg.sender, hashMsg);
        // Duplicated deposits
        require(!depositsSigned(hashSender));
        setDepositsSigned(hashSender, true);

        uint256 signed = numDepositsSigned(hashMsg);
        require(!isAlreadyProcessed(signed));
        // the check above assumes that the case when the value could be overflew will not happen in the addition operation below
        signed = signed + 1;

        setNumDepositsSigned(hashMsg, signed);

        emit SignedForDeposit(msg.sender, transactionHash);

        if (signed >= validatorContract().requiredSignatures()) {
            // If the bridge contract does not own enough tokens to transfer
            // it will couse funds lock on the home side of the bridge
            setNumDepositsSigned(hashMsg, markAsProcessed(signed));
            recipient.transfer(value);
            emit Withdraw(recipient, value, transactionHash);
        }
    }

    function numDepositsSigned(bytes32 _deposit) private view returns(uint256) {
        return uintStorage[keccak256("numDepositsSigned", _deposit)];
    }

    function setDepositsSigned(bytes32 _deposit, bool _status) private {
        boolStorage[keccak256("depositsSigned", _deposit)] = _status;
    }

    function setNumDepositsSigned(bytes32 _deposit, uint256 _number) private {
        uintStorage[keccak256("numDepositsSigned", _deposit)] = _number;
    }


    function depositsSigned(bytes32 _deposit) public view returns(bool) {
        return boolStorage[keccak256("depositsSigned", _deposit)];
    }

    function setHomeDailyLimit(uint256 _homeDailyLimit) external onlyOwner {
        uintStorage[keccak256("homeDailyLimit")] = _homeDailyLimit;
        emit DailyLimit(_homeDailyLimit);
    }

    function setMaxPerTx(uint256 _maxPerTx) external onlyOwner {
        require(_maxPerTx < homeDailyLimit());
        uintStorage[keccak256("maxPerTx")] = _maxPerTx;
    }

    function setMinPerTx(uint256 _minPerTx) external onlyOwner {
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

    function submitSignature(bytes signature, bytes message) external onlyValidator {
        // ensure that `signature` is really `message` signed by `msg.sender`
        require(Message.isMessageValid(message));
        require(msg.sender == Message.recoverAddressFromSignedMessage(signature, message));
        bytes32 hashMsg = keccak256(message);
        bytes32 hashSender = keccak256(msg.sender, hashMsg);

        uint256 signed = numMessagesSigned(hashMsg);
        require(!isAlreadyProcessed(signed));
        // the check above assumes that the case when the value could be overflew will not happen in the addition operation below
        signed = signed + 1;
        if (signed > 1) {
            // Duplicated signatures
            require(!messagesSigned(hashSender));
        } else {
            setMessages(hashMsg, message);
        }
        setMessagesSigned(hashSender, true);

        bytes32 signIdx = keccak256(hashMsg, (signed-1));
        setSignatures(signIdx, signature);

        setNumMessagesSigned(hashMsg, signed);

        emit SignedForDeposit(msg.sender, hashMsg);
        if (signed >= validatorContract().requiredSignatures()) {
            setNumMessagesSigned(hashMsg, markAsProcessed(signed));
            emit CollectedSignatures(msg.sender, hashMsg);
        }
    }

    function setMessagesSigned(bytes32 _hash, bool _status) private {
        boolStorage[keccak256("messagesSigned", _hash)] = _status;
    }

    function signature(bytes32 _hash, uint256 _index) public view returns (bytes) {
        bytes32 signIdx = keccak256(_hash, _index);
        return signatures(signIdx);
    }

    function messagesSigned(bytes32 _message) public view returns(bool) {
        return boolStorage[keccak256("messagesSigned", _message)];
    }

    function messages(bytes32 _hash) private view returns(bytes) {
        return bytesStorage[keccak256("messages", _hash)];
    }

    function signatures(bytes32 _hash) private view returns(bytes) {
        return bytesStorage[keccak256("signatures", _hash)];
    }


    function setSignatures(bytes32 _hash, bytes _signature) private {
        bytesStorage[keccak256("signatures", _hash)] = _signature;
    }

    function setMessages(bytes32 _hash, bytes _message) private {
        bytesStorage[keccak256("messages", _hash)] = _message;
    }

    function message(bytes32 _hash) public view returns (bytes) {
        return messages(_hash);
    }

    function setNumMessagesSigned(bytes32 _message, uint256 _number) private {
        uintStorage[keccak256("numMessagesSigned", _message)] = _number;
    }

    function markAsProcessed(uint256 _v) private pure returns(uint256) {
        return _v | 2 ** 255;
    }

    function isAlreadyProcessed(uint256 _number) public pure returns(bool) {
        return _number & 2**255 == 2**255;
    }

    function numMessagesSigned(bytes32 _message) private view returns(uint256) {
        return uintStorage[keccak256("numMessagesSigned", _message)];
    }


}
