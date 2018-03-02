pragma solidity 0.4.19;
import "./libraries/Helpers.sol";
import "./libraries/Message.sol";
import "./libraries/MessageSigning.sol";
import "./IBridgeValidators.sol";
import "./Validatable.sol";
import "./BridgeDeploymentAddressStorage.sol";
import "./IBurnableMintableERC677Token.sol";
import "./ERC677Receiver.sol";

contract ForeignBridge is ERC677Receiver, Validatable, BridgeDeploymentAddressStorage {
    uint256 public gasLimitDepositRelay;
    uint256 public gasLimitWithdrawConfirm;
    uint256 homeGasPrice = 1000000000 wei;
    mapping (bytes32 => bytes) messages;
    mapping (bytes32 => bytes) signatures;
    mapping (bytes32 => bool) messages_signed;
    mapping (bytes32 => uint) num_messages_signed;
    mapping (bytes32 => bool) deposits_signed;
    mapping (bytes32 => uint) num_deposits_signed;

    mapping (bytes32 => bool) tokenAddressApprovalSigns;
    mapping (address => uint256) public numTokenAddressApprovalSigns;

    IBurnableMintableERC677Token public erc677token;

    /// triggered when relay of deposit from HomeBridge is complete
    event Deposit(address recipient, uint value);

    /// Event created on money withdraw.
    event Withdraw(address recipient, uint256 value, uint256 homeGasPrice);

    /// Collected signatures which should be relayed to home chain.
    event CollectedSignatures(address authorityResponsibleForRelay, bytes32 messageHash);

    event TokenAddress(address token);

    event GasConsumptionLimitsUpdated(uint256 gasLimitDepositRelay, uint256 gasLimitWithdrawConfirm);

    function ForeignBridge(
        address _validatorContract,
        address _erc677token
    ) public Validatable(_validatorContract) {
        erc677token = IBurnableMintableERC677Token(_erc677token);
    }

    function setGasLimitDepositRelay(uint256 gas) onlyValidator {
        gasLimitDepositRelay = gas;

        GasConsumptionLimitsUpdated(gasLimitDepositRelay, gasLimitWithdrawConfirm);
    }

    function setGasLimitWithdrawConfirm(uint256 gas) onlyValidator {
        gasLimitWithdrawConfirm = gas;

        GasConsumptionLimitsUpdated(gasLimitDepositRelay, gasLimitWithdrawConfirm);
    }

    function deposit(address recipient, uint value, bytes32 transactionHash) public onlyValidator {
        require(erc677token != address(0x0));

        // Protection from misbehaing authority
        bytes32 hash_msg = keccak256(recipient, value, transactionHash);
        bytes32 hash_sender = keccak256(msg.sender, hash_msg);

        // Duplicated deposits
        require(!deposits_signed[hash_sender]);
        deposits_signed[hash_sender] = true;

        uint signed = num_deposits_signed[hash_msg] + 1;
        num_deposits_signed[hash_msg] = signed;

        if (signed == validatorContract.requiredSignatures()) {
            // If the bridge contract does not own enough tokens to transfer
            // it will couse funds lock on the home side of the bridge
            erc677token.mint(recipient, value);
            Deposit(recipient, value);
        }
    }

    function onTokenTransfer(address _from, uint256 _value, bytes _data) external returns(bool) {
        require(erc677token != address(0x0));
        require(msg.sender == address(erc677token));
        erc677token.burn(_value);
        Withdraw(_from, _value, homeGasPrice);
        return true;
    }

    /// Should be used as sync tool
    ///
    /// Message is a message that should be relayed to main chain once authorities sign it.
    ///
    /// for withdraw message contains:
    /// withdrawal recipient (bytes20)
    /// withdrawal value (uint)
    /// foreign transaction hash (bytes32) // to avoid transaction duplication
    function submitSignature(bytes signature, bytes message) public onlyValidator {
        // ensure that `signature` is really `message` signed by `msg.sender`
        require(msg.sender == MessageSigning.recoverAddressFromSignedMessage(signature, message));

        require(message.length == 116);
        bytes32 hash = keccak256(message);
        bytes32 hash_sender = keccak256(msg.sender, hash);

        uint signed = num_messages_signed[hash_sender] + 1;

        if (signed > 1) {
            // Duplicated signatures
            require(!messages_signed[hash_sender]);
        }
        else {
            // check if it will really reduce gas usage in case of the second transaction
            // with the same hash
            messages[hash] = message;
        }
        messages_signed[hash_sender] = true;

        bytes32 sign_idx = keccak256(hash, (signed-1));
        signatures[sign_idx] = signature;

        num_messages_signed[hash_sender] = signed;

        // TODO: this may cause troubles if requiredSignatures len is changed
        if (signed == validatorContract.requiredSignatures()) {
            CollectedSignatures(msg.sender, hash);
        }
    }

    function signature(bytes32 hash, uint index) public view returns (bytes) {
        bytes32 sign_idx = keccak256(hash, index);
        return signatures[sign_idx];
    }

    /// Get message
    function message(bytes32 hash) public view returns (bytes) {
        return messages[hash];
    }

}
