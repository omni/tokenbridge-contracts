pragma solidity 0.4.23;
import "../libraries/SafeMath.sol";
import "../libraries/Message.sol";
import "./U_BasicBridge.sol";
import "../IBurnableMintableERC677Token.sol";
import "../ERC677Receiver.sol";
import "openzeppelin-solidity/contracts/token/ERC20/ERC20Basic.sol";


contract ForeignBridge is ERC677Receiver, BasicBridge {
    using SafeMath for uint256;
    /// triggered when relay of deposit from HomeBridge is complete
    event Deposit(address recipient, uint value, bytes32 transactionHash);

    /// Event created on money withdraw.
    event Withdraw(address recipient, uint256 value, uint256 homeGasPrice);

    /// Collected signatures which should be relayed to home chain.
    event CollectedSignatures(address authorityResponsibleForRelay, bytes32 messageHash);

    event GasConsumptionLimitsUpdated(uint256 gasLimitDepositRelay, uint256 gasLimitWithdrawConfirm);

    event SignedForDeposit(address indexed signer, bytes32 transactionHash);
    event SignedForWithdraw(address indexed signer, bytes32 messageHash);
    event DailyLimit(uint256 newLimit);

    function initialize(
        address _validatorContract,
        address _erc677token,
        uint256 _foreignDailyLimit,
        uint256 _maxPerTx,
        uint256 _minPerTx,
        uint256 _foreignGasPrice,
        uint256 _requiredBlockConfirmations
    ) public returns(bool) {
        require(!isInitialized());
        require(_validatorContract != address(0));
        require(_minPerTx > 0 && _maxPerTx > _minPerTx && _foreignDailyLimit > _maxPerTx);
        require(_foreignGasPrice > 0);
        addressStorage[keccak256("validatorContract")] = _validatorContract;
        setErc677token(_erc677token);
        uintStorage[keccak256("foreignDailyLimit")] = _foreignDailyLimit;
        uintStorage[keccak256("deployedAtBlock")] = block.number;
        uintStorage[keccak256("maxPerTx")] = _maxPerTx;
        uintStorage[keccak256("minPerTx")] = _minPerTx;
        uintStorage[keccak256("gasPrice")] = _foreignGasPrice;
        uintStorage[keccak256("requiredBlockConfirmations")] = _requiredBlockConfirmations;
        setInitialize(true);
        return isInitialized();
    }

    function onTokenTransfer(address _from, uint256 _value, bytes /*_data*/) external returns(bool) {
        require(msg.sender == address(erc677token()));
        require(withinLimit(_value));
        setTotalSpentPerDay(getCurrentDay(), totalSpentPerDay(getCurrentDay()).add(_value));
        erc677token().burn(_value);
        emit Withdraw(_from, _value, gasPriceForCompensationAtHomeSide());
        return true;
    }

    function setMaxPerTx(uint256 _maxPerTx) external onlyOwner {
        require(_maxPerTx < foreignDailyLimit());
        uintStorage[keccak256("maxPerTx")] = _maxPerTx;
    }

    function setMinPerTx(uint256 _minPerTx) external onlyOwner {
        require(_minPerTx < foreignDailyLimit() && _minPerTx < maxPerTx());
        uintStorage[keccak256("minPerTx")] = _minPerTx;
    }

    function claimTokens(address _token, address _to) external onlyOwner {
        require(_to != address(0));
        if (_token == address(0)) {
            _to.transfer(address(this).balance);
            return;
        }

        ERC20Basic token = ERC20Basic(_token);
        uint256 balance = token.balanceOf(this);
        require(token.transfer(_to, balance));
    }

    function claimTokensFromErc677(address _token, address _to) external onlyOwner {
        erc677token().claimTokens(_token, _to);
    }

    function minPerTx() public view returns(uint256) {
        return uintStorage[keccak256("minPerTx")];
    }

    function maxPerTx() public view returns(uint256) {
        return uintStorage[keccak256("maxPerTx")];
    }

    function totalSpentPerDay(uint256 _day) public view returns(uint256) {
        return uintStorage[keccak256("totalSpentPerDay", _day)];
    }

    function deployedAtBlock() public view returns(uint256) {
        return uintStorage[keccak256("deployedAtBlock")];
    }

    function gasLimitDepositRelay() public view returns(uint256) {
        return uintStorage[keccak256("gasLimitDepositRelay")];
    }

    function gasLimitWithdrawConfirm() public view returns(uint256) {
        return uintStorage[keccak256("gasLimitWithdrawConfirm")];
    }

    function foreignDailyLimit() public view returns(uint256) {
        return uintStorage[keccak256("foreignDailyLimit")];
    }

    function erc677token() public view returns(IBurnableMintableERC677Token) {
        return IBurnableMintableERC677Token(addressStorage[keccak256("erc677token")]);
    }

    function setGasLimits(uint256 _gasLimitDepositRelay, uint256 _gasLimitWithdrawConfirm) external onlyOwner {
        uintStorage[keccak256("gasLimitDepositRelay")] = _gasLimitDepositRelay;
        uintStorage[keccak256("gasLimitWithdrawConfirm")] = _gasLimitWithdrawConfirm;
        emit GasConsumptionLimitsUpdated(gasLimitDepositRelay(), gasLimitWithdrawConfirm());
    }

    function deposit(address recipient, uint256 value, bytes32 transactionHash) external onlyValidator {
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
            erc677token().mint(recipient, value);
            emit Deposit(recipient, value, transactionHash);
        }
    }

    /// Should be used as sync tool
    ///
    /// Message is a message that should be relayed to main chain once authorities sign it.
    ///
    /// for withdraw message contains:
    /// withdrawal recipient (bytes20)
    /// withdrawal value (uint)
    /// foreign transaction hash (bytes32) // to avoid transaction duplication
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

        emit SignedForWithdraw(msg.sender, hashMsg);
        if (signed >= validatorContract().requiredSignatures()) {
            setNumMessagesSigned(hashMsg, markAsProcessed(signed));
            emit CollectedSignatures(msg.sender, hashMsg);
        }
    }

    function gasPriceForCompensationAtHomeSide() public pure returns(uint256) {
        return 1000000000 wei;
    }

    function isAlreadyProcessed(uint256 _number) public pure returns(bool) {
        return _number & 2**255 == 2**255;
    }

    function signature(bytes32 _hash, uint256 _index) public view returns (bytes) {
        bytes32 signIdx = keccak256(_hash, _index);
        return signatures(signIdx);
    }

    /// Get message
    function message(bytes32 _hash) public view returns (bytes) {
        return messages(_hash);
    }

    function getCurrentDay() public view returns(uint256) {
        return now / 1 days;
    }

    function setForeignDailyLimit(uint256 _foreignDailyLimit) public onlyOwner {
        uintStorage[keccak256("foreignDailyLimit")] = _foreignDailyLimit;
        emit DailyLimit(_foreignDailyLimit);
    }

    function withinLimit(uint256 _amount) public view returns(bool) {
        uint256 nextLimit = totalSpentPerDay(getCurrentDay()).add(_amount);
        return foreignDailyLimit() >= nextLimit && _amount <= maxPerTx() && _amount >= minPerTx();
    }

    function isInitialized() public view returns(bool) {
        return boolStorage[keccak256("isInitialized")];
    }

    function messages(bytes32 _hash) private view returns(bytes) {
        return bytesStorage[keccak256("messages", _hash)];
    }

    function setMessages(bytes32 _hash, bytes _message) private {
        bytesStorage[keccak256("messages", _hash)] = _message;
    }

    function signatures(bytes32 _hash) private view returns(bytes) {
        return bytesStorage[keccak256("signatures", _hash)];
    }

    function setSignatures(bytes32 _hash, bytes _signature) private {
        bytesStorage[keccak256("signatures", _hash)] = _signature;
    }

    function messagesSigned(bytes32 _message) public view returns(bool) {
        return boolStorage[keccak256("messagesSigned", _message)];
    }

    function depositsSigned(bytes32 _deposit) public view returns(bool) {
        return boolStorage[keccak256("depositsSigned", _deposit)];
    }

    function markAsProcessed(uint256 _v) private pure returns(uint256) {
        return _v | 2 ** 255;
    }

    function numMessagesSigned(bytes32 _message) private view returns(uint256) {
        return uintStorage[keccak256("numMessagesSigned", _message)];
    }

    function numDepositsSigned(bytes32 _deposit) private view returns(uint256) {
        return uintStorage[keccak256("numDepositsSigned", _deposit)];
    }

    function setMessagesSigned(bytes32 _hash, bool _status) private {
        boolStorage[keccak256("messagesSigned", _hash)] = _status;
    }

    function setDepositsSigned(bytes32 _deposit, bool _status) private {
        boolStorage[keccak256("depositsSigned", _deposit)] = _status;
    }

    function setNumMessagesSigned(bytes32 _message, uint256 _number) private {
        uintStorage[keccak256("numMessagesSigned", _message)] = _number;
    }

    function setNumDepositsSigned(bytes32 _deposit, uint256 _number) private {
        uintStorage[keccak256("numDepositsSigned", _deposit)] = _number;
    }

    function setTotalSpentPerDay(uint256 _day, uint256 _value) private {
        uintStorage[keccak256("totalSpentPerDay", _day)] = _value;
    }

    function setErc677token(address _token) private {
        require(_token != address(0));
        addressStorage[keccak256("erc677token")] = _token;
    }

    function setInitialize(bool _status) private {
        boolStorage[keccak256("isInitialized")] = _status;
    }

}
