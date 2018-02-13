pragma solidity 0.4.19;
import "./libraries/Helpers.sol";
import "./libraries/Message.sol";
import "./libraries/MessageSigning.sol";
// import "./libraries/SafeMath.sol";
import "./IBurnableMintableERC827Token.sol";
import "./POA20.sol";

contract ForeignBridge {
    // following is the part of ForeignBridge that implements an ERC20 token.
    // ERC20 spec: https://github.com/ethereum/EIPs/blob/master/EIPS/eip-20-token-standard.md

    // uint public totalSupply;

    // string public name = "POA ERC20 Foundation";
    // string public symbol = "POA20";
    // /// maps addresses to their token balances
    // mapping (address => uint) public balances;

    // // owner of account approves the transfer of an amount by another account
    // mapping(address => mapping (address => uint)) allowed;

    // /// Event created on money transfer
    // event Transfer(address indexed from, address indexed to, uint tokens);

    // // returns the ERC20 token balance of the given address
    // function balanceOf(address tokenOwner) public view returns (uint) {
    //     return balances[tokenOwner];
    // }

    // /// Transfer `value` to `recipient` on this `foreign` chain.
    // ///
    // /// does not affect `home` chain. does not do a relay.
    // /// as specificed in ERC20 this doesn't fail if tokens == 0.
    // function transfer(address recipient, uint tokens) public returns (bool) {
    //     require(balances[msg.sender] >= tokens);
    //     // fails if there is an overflow
    //     require(balances[recipient] + tokens >= balances[recipient]);

    //     balances[msg.sender] -= tokens;
    //     balances[recipient] += tokens;
    //     Transfer(msg.sender, recipient, tokens);
    //     return true;
    // }

    // // following is the part of ForeignBridge that is concerned
    // // with the part of the ERC20 standard responsible for giving others spending rights
    // // and spending others tokens

    // // created when `approve` is executed to mark that
    // // `tokenOwner` has approved `spender` to spend `tokens` of his tokens
    // event Approval(address indexed tokenOwner, address indexed spender, uint tokens);

    // // allow `spender` to withdraw from your account, multiple times, up to the `tokens` amount.
    // // calling this function repeatedly overwrites the current allowance.
    // function approve(address spender, uint tokens) public returns (bool) {
    //     allowed[msg.sender][spender] = tokens;
    //     Approval(msg.sender, spender, tokens);
    //     return true;
    // }

    // // returns how much `spender` is allowed to spend of `owner`s tokens
    // function allowance(address owner, address spender) public view returns (uint256) {
    //     return allowed[owner][spender];
    // }

    // function transferFrom(address from, address to, uint tokens) public returns (bool) {
    //     // `from` has enough tokens
    //     require(balances[from] >= tokens);
    //     // `sender` is allowed to move `tokens` from `from`
    //     require(allowed[from][msg.sender] >= tokens);
    //     // fails if there is an overflow
    //     require(balances[to] + tokens >= balances[to]);

    //     balances[to] += tokens;
    //     balances[from] -= tokens;
    //     allowed[from][msg.sender] -= tokens;

    //     Transfer(from, to, tokens);
    //     return true;
    // }

    // following is the part of ForeignBridge that is
    // no longer part of ERC20 and is concerned with
    // with moving tokens from and to HomeBridge

    struct SignaturesCollection {
        /// Signed message.
        bytes message;
        /// Authorities who signed the message.
        address[] signed;
        /// Signatures
        bytes[] signatures;
    }

    /// Number of authorities signatures required to withdraw the money.
    ///
    /// Must be less than number of authorities.
    uint public requiredSignatures;

    /// Contract authorities.
    address[] public authorities;

    /// Pending deposits and authorities who confirmed them
    mapping (bytes32 => address[]) deposits;

    /// Pending signatures and authorities who confirmed them
    mapping (bytes32 => SignaturesCollection) signatures;

    /// Token contract which the bridge has full ownership to burn and mint
    POA20 public token;

    /// triggered when relay of deposit from HomeBridge is complete
    event Deposit(address recipient, uint value);

    /// Event created on money withdraw.
    event Withdraw(address recipient, uint value);

    /// Collected signatures which should be relayed to home chain.
    event CollectedSignatures(address authorityResponsibleForRelay, bytes32 messageHash);

    function ForeignBridge(
        uint _requiredSignatures,
        address[] _authorities, 
        address _token
    ) public
    {
        require(_requiredSignatures != 0);
        require(_requiredSignatures <= _authorities.length);
        require(_token != address(0));
        requiredSignatures = _requiredSignatures;
        authorities = _authorities;
        token = POA20(_token);
    }

    /// require that sender is an authority
    modifier onlyAuthority() {
        require(Helpers.addressArrayContains(authorities, msg.sender));
        _;
    }

    /// Used to deposit money to the contract.
    ///
    /// deposit recipient (bytes20)
    /// deposit value (uint)
    /// mainnet transaction hash (bytes32) // to avoid transaction duplication
    function deposit(address recipient, uint value, bytes32 transactionHash) public onlyAuthority() {
        // Protection from misbehaving authority
        var hash = keccak256(recipient, value, transactionHash);

        // don't allow authority to confirm deposit twice
        require(!Helpers.addressArrayContains(deposits[hash], msg.sender));

        deposits[hash].push(msg.sender);
        // TODO: this may cause troubles if requiredSignatures len is changed
        if (deposits[hash].length == requiredSignatures) {
            token.mint(recipient, value);
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
    function submitSignature(bytes signature, bytes message) public onlyAuthority() {
        // Validate submited signatures
        require(MessageSigning.recoverAddressFromSignedMessage(signature, message) == msg.sender);

        // Valid withdraw message must have 84 bytes
        require(message.length == 84);
        var hash = keccak256(message);

        // Duplicated signatures
        require(!Helpers.addressArrayContains(signatures[hash].signed, msg.sender));
        signatures[hash].message = message;
        signatures[hash].signed.push(msg.sender);
        signatures[hash].signatures.push(signature);

        // TODO: this may cause troubles if requiredSignatures len is changed
        if (signatures[hash].signed.length == requiredSignatures) {
            CollectedSignatures(msg.sender, hash);
        }
    }

    /// Get signature
    function signature(bytes32 hash, uint index) public view returns (bytes) {
        return signatures[hash].signatures[index];
    }

    /// Get message
    function message(bytes32 hash) public view returns (bytes) {
        return signatures[hash].message;
    }
}