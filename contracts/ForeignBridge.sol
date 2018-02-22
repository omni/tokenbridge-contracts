pragma solidity 0.4.19;
import "./libraries/Helpers.sol";
import "./libraries/Message.sol";
import "./libraries/MessageSigning.sol";
import "./BridgeValidators.sol";

contract ForeignBridge {
    mapping (bytes32 => bool) deposits_signed;
    mapping (bytes32 => uint8) num_deposits_signed;
	mapping (bytes32 => bool) mintRequestsDone;
	mapping (bytes32 => uint8) withdrawRequests;

    /// Pending signatures and authorities who confirmed them
    BridgeValidators public validatorsContract;

    /// Token contract which the bridge has full ownership to burn and mint
    address public token;

    /// triggered when relay of deposit from HomeBridge is complete
    event Deposit(address recipient, uint value);

    /// Event created on money withdraw.
    event Withdraw(address recipient, uint value);

    /// Collected signatures which should be relayed to home chain.
    event CollectedSignatures(address authorityResponsibleForRelay, bytes32 messageHash);

    function ForeignBridge(
        address _token,
        address _validatorsContract
    ) public
    {
        require(_token != address(0) && _validatorsContract != address(0));
        validatorsContract = BridgeValidators(_validatorsContract);
        token = _token;
    }


    /// Used to deposit money to the contract.
    ///
    /// deposit recipient (bytes20)
    /// deposit value (uint)
    /// mainnet transaction hash (bytes32) // to avoid transaction duplication
    function deposit(address recipient, uint256 value, bytes32 transactionHash) public {
        require(validatorsContract.onlyValidator(msg.sender));
        bytes32 hash_msg = keccak256(recipient, value, transactionHash);
        bytes32 hash_sender = keccak256(msg.sender, hash_msg);

        // Prevents Duplicated deposits
        require(!deposits_signed[hash_sender]);
        deposits_signed[hash_sender] = true;

        uint8 signed = num_deposits_signed[hash_msg] + 1;
        num_deposits_signed[hash_msg] = signed;

        if (signed == requiredValidators) {
            // token.mint(recipient, value);
            Deposit(recipient, value);
        }
    }

    /// Transfer `value` from `msg.sender`s local balance (on `foreign` chain) to `recipient` on `home` chain.
    ///
    /// immediately decreases `msg.sender`s local balance.
    /// emits a `Withdraw` event which will be picked up by the bridge authorities.
    /// bridge authorities will then sign off (by calling `submitSignature`) on a message containing `value`,
    /// `recipient` and the `hash` of the transaction on `foreign` containing the `Withdraw` event.
    /// once `requiredSignatures` are collected a `CollectedSignatures` event will be emitted.
    /// an authority will pick up `CollectedSignatures` an call `HomeBridge.withdraw`
    /// which transfers `value - relayCost` to `recipient` completing the transfer.
    function transferHomeViaRelay(address recipient, uint256 value) public {
        Withdraw(recipient, value);
    }

    /// Should be used as sync tool
    ///
    /// Message is a message that should be relayed to main chain once authorities sign it.
    ///
    /// for withdraw message contains:
    /// withdrawal recipient (bytes20)
    /// withdrawal value (uint)
    /// foreign transaction hash (bytes32) // to avoid transaction duplication
    function submitSignature(bytes signature, bytes message) public {
        require(validatorsContract.onlyValidator(msg.sender));
        // Validate submited signatures
        require(MessageSigning.recoverAddressFromSignedMessage(signature, message) == msg.sender);

        // Valid withdraw message must have 84 bytes
        require(message.length == 84);
        var hash = keccak256(message);

        // Duplicated signatures
        // require(!Helpers.addressArrayContains(signatures[hash].signed, msg.sender));
        // signatures[hash].message = message;
        // signatures[hash].signed.push(msg.sender);
        // signatures[hash].signatures.push(signature);

        // TODO: this may cause troubles if requiredSignatures len is changed
        // if (signatures[hash].signed.length == requiredSignatures) {
            CollectedSignatures(msg.sender, hash);
        // }
    }

    /// Get signature
    // function signature(bytes32 hash, uint index) public view returns (bytes) {
    //     return signatures[hash].signatures[index];
    // }

    // /// Get message
    // function message(bytes32 hash) public view returns (bytes) {
    //     return signatures[hash].message;
    // }
}