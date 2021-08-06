pragma solidity 0.4.24;

import "./ERC677BridgeToken.sol";

contract PermittableToken is ERC677BridgeToken {
    string public constant version = "1";

    // EIP712 niceties
    bytes32 public DOMAIN_SEPARATOR;
    // bytes32 public constant PERMIT_TYPEHASH_LEGACY = keccak256("Permit(address holder,address spender,uint256 nonce,uint256 expiry,bool allowed)");
    bytes32 public constant PERMIT_TYPEHASH_LEGACY = 0xea2aa0a1be11a07ed86d755c93467f4f82362b452371d1ba94d1715123511acb;
    // bytes32 public constant PERMIT_TYPEHASH = keccak256("Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)");
    bytes32 public constant PERMIT_TYPEHASH = 0x6e71edae12b1b97f4d1f60370fef10105fa2faae0126114a169c64845d6126c9;

    mapping(address => uint256) public nonces;
    mapping(address => mapping(address => uint256)) public expirations;

    constructor(string memory _name, string memory _symbol, uint8 _decimals, uint256 _chainId)
        public
        ERC677BridgeToken(_name, _symbol, _decimals)
    {
        require(_chainId != 0);
        DOMAIN_SEPARATOR = keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256(bytes(_name)),
                keccak256(bytes(version)),
                _chainId,
                address(this)
            )
        );
    }

    /// @dev transferFrom in this contract works in a slightly different form than the generic
    /// transferFrom function. This contract allows for "unlimited approval".
    /// Should the user approve an address for the maximum uint256 value,
    /// then that address will have unlimited approval until told otherwise.
    /// @param _sender The address of the sender.
    /// @param _recipient The address of the recipient.
    /// @param _amount The value to transfer.
    /// @return Success status.
    function transferFrom(address _sender, address _recipient, uint256 _amount) public returns (bool) {
        require(_sender != address(0));
        require(_recipient != address(0));

        balances[_sender] = balances[_sender].sub(_amount);
        balances[_recipient] = balances[_recipient].add(_amount);
        emit Transfer(_sender, _recipient, _amount);

        if (_sender != msg.sender) {
            uint256 allowedAmount = allowance(_sender, msg.sender);

            if (allowedAmount != uint256(-1)) {
                // If allowance is limited, adjust it.
                // In this case `transferFrom` works like the generic
                allowed[_sender][msg.sender] = allowedAmount.sub(_amount);
                emit Approval(_sender, msg.sender, allowed[_sender][msg.sender]);
            } else {
                // If allowance is unlimited by `permit`, `approve`, or `increaseAllowance`
                // function, don't adjust it. But the expiration date must be empty or in the future
                require(expirations[_sender][msg.sender] == 0 || expirations[_sender][msg.sender] >= now);
            }
        } else {
            // If `_sender` is `msg.sender`,
            // the function works just like `transfer()`
        }

        callAfterTransfer(_sender, _recipient, _amount);
        return true;
    }

    /// @dev Approve the passed address to spend the specified amount of tokens on behalf of msg.sender.
    /// @param _to The address which will spend the funds.
    /// @param _value The amount of tokens to be spent.
    function approve(address _to, uint256 _value) public returns (bool result) {
        _approveAndResetExpirations(msg.sender, _to, _value);
        return true;
    }

    /// @dev Atomically increases the allowance granted to spender by the caller.
    /// @param _to The address which will spend the funds.
    /// @param _addedValue The amount of tokens to increase the allowance by.
    function increaseAllowance(address _to, uint256 _addedValue) public returns (bool result) {
        _approveAndResetExpirations(msg.sender, _to, allowed[msg.sender][_to].add(_addedValue));
        return true;
    }

    /// @dev An alias for `transfer` function.
    /// @param _to The address of the recipient.
    /// @param _amount The value to transfer.
    function push(address _to, uint256 _amount) public {
        transferFrom(msg.sender, _to, _amount);
    }

    /// @dev Makes a request to transfer the specified amount
    /// from the specified address to the caller's address.
    /// @param _from The address of the holder.
    /// @param _amount The value to transfer.
    function pull(address _from, uint256 _amount) public {
        transferFrom(_from, msg.sender, _amount);
    }

    /// @dev An alias for `transferFrom` function.
    /// @param _from The address of the sender.
    /// @param _to The address of the recipient.
    /// @param _amount The value to transfer.
    function move(address _from, address _to, uint256 _amount) public {
        transferFrom(_from, _to, _amount);
    }

    /// @dev Allows to spend holder's unlimited amount by the specified spender.
    /// The function can be called by anyone, but requires having allowance parameters
    /// signed by the holder according to EIP712.
    /// @param _holder The holder's address.
    /// @param _spender The spender's address.
    /// @param _nonce The nonce taken from `nonces(_holder)` public getter.
    /// @param _expiry The allowance expiration date (unix timestamp in UTC).
    /// Can be zero for no expiration. Forced to zero if `_allowed` is `false`.
    /// Note that timestamps are not precise, malicious miner/validator can manipulate them to some extend.
    /// Assume that there can be a 900 seconds time delta between the desired timestamp and the actual expiration.
    /// @param _allowed True to enable unlimited allowance for the spender by the holder. False to disable.
    /// @param _v A final byte of signature (ECDSA component).
    /// @param _r The first 32 bytes of signature (ECDSA component).
    /// @param _s The second 32 bytes of signature (ECDSA component).
    function permit(
        address _holder,
        address _spender,
        uint256 _nonce,
        uint256 _expiry,
        bool _allowed,
        uint8 _v,
        bytes32 _r,
        bytes32 _s
    ) external {
        require(_expiry == 0 || now <= _expiry);

        bytes32 digest = _digest(abi.encode(PERMIT_TYPEHASH_LEGACY, _holder, _spender, _nonce, _expiry, _allowed));

        require(_holder == _recover(digest, _v, _r, _s));
        require(_nonce == nonces[_holder]++);

        uint256 amount = _allowed ? uint256(-1) : 0;

        expirations[_holder][_spender] = _allowed ? _expiry : 0;

        _approve(_holder, _spender, amount);
    }

    /** @dev Allows to spend holder's unlimited amount by the specified spender according to EIP2612.
     * The function can be called by anyone, but requires having allowance parameters
     * signed by the holder according to EIP712.
     * @param _holder The holder's address.
     * @param _spender The spender's address.
     * @param _value Allowance value to set as a result of the call.
     * @param _deadline The deadline timestamp to call the permit function. Must be a timestamp in the future.
     * Note that timestamps are not precise, malicious miner/validator can manipulate them to some extend.
     * Assume that there can be a 900 seconds time delta between the desired timestamp and the actual expiration.
     * @param _v A final byte of signature (ECDSA component).
     * @param _r The first 32 bytes of signature (ECDSA component).
     * @param _s The second 32 bytes of signature (ECDSA component).
     */
    function permit(
        address _holder,
        address _spender,
        uint256 _value,
        uint256 _deadline,
        uint8 _v,
        bytes32 _r,
        bytes32 _s
    ) external {
        require(now <= _deadline);

        uint256 nonce = nonces[_holder]++;
        bytes32 digest = _digest(abi.encode(PERMIT_TYPEHASH, _holder, _spender, _value, nonce, _deadline));

        require(_holder == _recover(digest, _v, _r, _s));

        _approveAndResetExpirations(_holder, _spender, _value);
    }

    /**
     * @dev Sets a new allowance value for the given owner and spender addresses.
     * Resets expiration timestamp in case of unlimited approval.
     * @param _owner address tokens holder.
     * @param _spender address of tokens spender.
     * @param _amount amount of approved tokens.
     */
    function _approveAndResetExpirations(address _owner, address _spender, uint256 _amount) internal {
        _approve(_owner, _spender, _amount);

        // it is not necessary to reset _expirations in other cases, since it is only used together with infinite allowance
        if (_amount == uint256(-1)) {
            delete expirations[_owner][_spender];
        }
    }

    /**
     * @dev Internal function for issuing an allowance.
     * @param _owner address of the tokens owner.
     * @param _spender address of the approved tokens spender.
     * @param _amount amount of the approved tokens.
     */
    function _approve(address _owner, address _spender, uint256 _amount) internal {
        require(_owner != address(0), "ERC20: approve from the zero address");
        require(_spender != address(0), "ERC20: approve to the zero address");

        allowed[_owner][_spender] = _amount;
        emit Approval(_owner, _spender, _amount);
    }

    /**
     * @dev Calculates the message digest for encoded EIP712 typed struct.
     * @param _typedStruct encoded payload.
     */
    function _digest(bytes memory _typedStruct) internal view returns (bytes32) {
        return keccak256(abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR, keccak256(_typedStruct)));
    }

    /**
     * @dev Derives the signer address for the given message digest and ECDSA signature params.
     * @param _digest signed message digest.
     * @param _v a final byte of signature (ECDSA component).
     * @param _r the first 32 bytes of the signature (ECDSA component).
     * @param _s the second 32 bytes of the signature (ECDSA component).
     */
    function _recover(bytes32 _digest, uint8 _v, bytes32 _r, bytes32 _s) internal pure returns (address) {
        require(_v == 27 || _v == 28, "ECDSA: invalid signature 'v' value");
        require(
            uint256(_s) <= 0x7FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF5D576E7357A4501DDFE92F46681B20A0,
            "ECDSA: invalid signature 's' value"
        );

        address signer = ecrecover(_digest, _v, _r, _s);
        require(signer != address(0), "ECDSA: invalid signature");

        return signer;
    }
}
