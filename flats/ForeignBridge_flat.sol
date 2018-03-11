pragma solidity 0.4.19;

// File: contracts/BridgeDeploymentAddressStorage.sol

contract BridgeDeploymentAddressStorage {
    uint256 public deployedAtBlock;

    function BridgeDeploymentAddressStorage() public {
        deployedAtBlock = block.number;
    }
}

// File: contracts/ERC677Receiver.sol

contract ERC677Receiver {
  function onTokenTransfer(address _from, uint _value, bytes _data) external returns(bool);
}

// File: contracts/IBridgeValidators.sol

interface IBridgeValidators {
    function isValidator(address _validator) public view returns(bool);
    function requiredSignatures() public view returns(uint8);
    function currentOwner() public view returns(address);
}

// File: zeppelin-solidity/contracts/token/ERC20/ERC20Basic.sol

/**
 * @title ERC20Basic
 * @dev Simpler version of ERC20 interface
 * @dev see https://github.com/ethereum/EIPs/issues/179
 */
contract ERC20Basic {
  function totalSupply() public view returns (uint256);
  function balanceOf(address who) public view returns (uint256);
  function transfer(address to, uint256 value) public returns (bool);
  event Transfer(address indexed from, address indexed to, uint256 value);
}

// File: zeppelin-solidity/contracts/token/ERC20/ERC20.sol

/**
 * @title ERC20 interface
 * @dev see https://github.com/ethereum/EIPs/issues/20
 */
contract ERC20 is ERC20Basic {
  function allowance(address owner, address spender) public view returns (uint256);
  function transferFrom(address from, address to, uint256 value) public returns (bool);
  function approve(address spender, uint256 value) public returns (bool);
  event Approval(address indexed owner, address indexed spender, uint256 value);
}

// File: contracts/ERC677.sol

contract ERC677 is ERC20 {
    event Transfer(address indexed from, address indexed to, uint value, bytes data);

    function transferAndCall(address, uint, bytes) public returns (bool);

}

// File: contracts/IBurnableMintableERC677Token.sol

contract IBurnableMintableERC677Token is ERC677 {
    function mint(address, uint256) public returns (bool);
    function burn(uint256 _value) public;
}

// File: contracts/Validatable.sol

contract Validatable {
    IBridgeValidators public validatorContract;

    modifier onlyValidator() {
        require(validatorContract.isValidator(msg.sender));
        _;
    }

    modifier onlyOwner() {
        require(validatorContract.currentOwner() == msg.sender);
        _;
    }

    function Validatable(address _validatorContract) public {
        require(_validatorContract != address(0));
        validatorContract = IBridgeValidators(_validatorContract);
    }
}

// File: contracts/libraries/Helpers.sol

library Helpers {
    function addressArrayContains(address[] array, address value) internal pure returns (bool) {
        for (uint256 i = 0; i < array.length; i++) {
            if (array[i] == value) {
                return true;
            }
        }
        return false;
    }

    function uintToString(uint256 inputValue) internal pure returns (string) {
        // figure out the length of the resulting string
        uint256 length = 0;
        uint256 currentValue = inputValue;
        do {
            length++;
            currentValue /= 10;
        } while (currentValue != 0);
        // allocate enough memory
        bytes memory result = new bytes(length);
        // construct the string backwards
        uint256 i = length - 1;
        currentValue = inputValue;
        do {
            result[i--] = byte(48 + currentValue % 10);
            currentValue /= 10;
        } while (currentValue != 0);
        return string(result);
    }

    function hasEnoughValidSignatures(
        bytes _message,
        uint8[] _vs,
        bytes32[] _rs,
        bytes32[] _ss,
        IBridgeValidators _validatorContract) internal view returns (bool) {
        uint8 _requiredSignatures = _validatorContract.requiredSignatures();
        require(_vs.length < _requiredSignatures);
        bytes32 hash = MessageSigning.hashMessage(_message);
        address[] memory encounteredAddresses = new address[](_requiredSignatures);

        for (uint8 i = 0; i < _requiredSignatures; i++) {
            address recoveredAddress = ecrecover(hash, _vs[i], _rs[i], _ss[i]);
            // only signatures by addresses in `addresses` are allowed
            require(_validatorContract.isValidator(recoveredAddress));
            // duplicate signatures are not allowed
            if (addressArrayContains(encounteredAddresses, recoveredAddress)) {
                return false;
            }
            encounteredAddresses[i] = recoveredAddress;
        }
        return true;
    }
}


library MessageSigning {
    function recoverAddressFromSignedMessage(bytes signature, bytes message) internal pure returns (address) {
        require(signature.length == 65);
        bytes32 r;
        bytes32 s;
        bytes1 v;
        // solium-disable-next-line security/no-inline-assembly
        assembly {
            r := mload(add(signature, 0x20))
            s := mload(add(signature, 0x40))
            v := mload(add(signature, 0x60))
        }
        return ecrecover(hashMessage(message), uint8(v), r, s);
    }

    function hashMessage(bytes message) internal pure returns (bytes32) {
        bytes memory prefix = "\x19Ethereum Signed Message:\n";
        return keccak256(prefix, Helpers.uintToString(message.length), message);
    }
}

// File: contracts/libraries/Message.sol

library Message {
    // layout of message :: bytes:
    // offset  0: 32 bytes :: uint256 - message length
    // offset 32: 20 bytes :: address - recipient address
    // offset 52: 32 bytes :: uint256 - value
    // offset 84: 32 bytes :: bytes32 - transaction hash
    // offset 116: 32 bytes :: uint256 - home gas price

    // bytes 1 to 32 are 0 because message length is stored as little endian.
    // mload always reads 32 bytes.
    // so we can and have to start reading recipient at offset 20 instead of 32.
    // if we were to read at 32 the address would contain part of value and be corrupted.
    // when reading from offset 20 mload will read 12 zero bytes followed
    // by the 20 recipient address bytes and correctly convert it into an address.
    // this saves some storage/gas over the alternative solution
    // which is padding address to 32 bytes and reading recipient at offset 32.
    // for more details see discussion in:
    // https://github.com/paritytech/parity-bridge/issues/61

    function getRecipient(bytes message) internal pure returns (address) {
        address recipient;
        // solium-disable-next-line security/no-inline-assembly
        assembly {
            recipient := mload(add(message, 20))
        }
        return recipient;
    }

    function getValue(bytes message) internal pure returns (uint256) {
        uint256 value;
        // solium-disable-next-line security/no-inline-assembly
        assembly {
            value := mload(add(message, 52))
        }
        return value;
    }

    function getTransactionHash(bytes message) internal pure returns (bytes32) {
        bytes32 hash;
        // solium-disable-next-line security/no-inline-assembly
        assembly {
            hash := mload(add(message, 84))
        }
        return hash;
    }

    function getHomeGasPrice(bytes message) internal pure returns (uint256) {
        uint256 gasPrice;
        // solium-disable-next-line security/no-inline-assembly
        assembly {
            gasPrice := mload(add(message, 116))
        }
        return gasPrice;
    }
}

// File: contracts/libraries/SafeMath.sol

/**
 * @title SafeMath
 * @dev Math operations with safety checks that throw on error
 */
library SafeMath {

  /**
  * @dev Multiplies two numbers, throws on overflow.
  */
  function mul(uint256 a, uint256 b) internal pure returns (uint256) {
    if (a == 0) {
      return 0;
    }
    uint256 c = a * b;
    assert(c / a == b);
    return c;
  }

  /**
  * @dev Integer division of two numbers, truncating the quotient.
  */
  function div(uint256 a, uint256 b) internal pure returns (uint256) {
    // assert(b > 0); // Solidity automatically throws when dividing by 0
    uint256 c = a / b;
    // assert(a == b * c + a % b); // There is no case in which this doesn't hold
    return c;
  }

  /**
  * @dev Substracts two numbers, throws on overflow (i.e. if subtrahend is greater than minuend).
  */
  function sub(uint256 a, uint256 b) internal pure returns (uint256) {
    assert(b <= a);
    return a - b;
  }

  /**
  * @dev Adds two numbers, throws on overflow.
  */
  function add(uint256 a, uint256 b) internal pure returns (uint256) {
    uint256 c = a + b;
    assert(c >= a);
    return c;
  }
}

// File: contracts/ForeignBridge.sol

contract ForeignBridge is ERC677Receiver, Validatable, BridgeDeploymentAddressStorage {
    using SafeMath for uint256;
    uint256 public gasLimitDepositRelay;
    uint256 public gasLimitWithdrawConfirm;
    uint256 homeGasPrice = 1000000000 wei;
    uint256 public foreignDailyLimit;
    mapping (bytes32 => bytes) messages;
    mapping (bytes32 => bytes) signatures;
    mapping (bytes32 => bool) messages_signed;
    mapping (bytes32 => uint256) num_messages_signed;
    mapping (bytes32 => bool) deposits_signed;
    mapping (bytes32 => uint256) num_deposits_signed;
    mapping (uint256 => uint256) totalSpentPerDay;

    IBurnableMintableERC677Token public erc677token;

    /// triggered when relay of deposit from HomeBridge is complete
    event Deposit(address recipient, uint value);

    /// Event created on money withdraw.
    event Withdraw(address recipient, uint256 value, uint256 homeGasPrice);

    /// Collected signatures which should be relayed to home chain.
    event CollectedSignatures(address authorityResponsibleForRelay, bytes32 messageHash);

    event GasConsumptionLimitsUpdated(uint256 gasLimitDepositRelay, uint256 gasLimitWithdrawConfirm);

    event SignedForDeposit(address indexed signer, bytes32 message);
    event SignedForWithdraw(address indexed signer, bytes32 message);
    event DailyLimit(uint256 newLimit);

    function ForeignBridge(
        address _validatorContract,
        address _erc677token,
        uint256 _foreignDailyLimit
    ) public Validatable(_validatorContract) {
        require(_foreignDailyLimit > 0);
        erc677token = IBurnableMintableERC677Token(_erc677token);
        foreignDailyLimit = _foreignDailyLimit;
    }

    function setGasLimitDepositRelay(uint256 _gas) public onlyOwner {
        gasLimitDepositRelay = _gas;

        GasConsumptionLimitsUpdated(gasLimitDepositRelay, gasLimitWithdrawConfirm);
    }

    function setGasLimitWithdrawConfirm(uint256 gas) public onlyOwner {
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

        uint256 signed = num_deposits_signed[hash_msg] + 1;
        num_deposits_signed[hash_msg] = signed;

        SignedForDeposit(msg.sender, transactionHash);

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
        require(withinLimit(_value));
        totalSpentPerDay[getCurrentDay()] = totalSpentPerDay[getCurrentDay()].add(_value);
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
        SignedForWithdraw(msg.sender, hash);
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

    function getCurrentDay() public view returns(uint256) {
        return now / 1 days;
    }

    function setDailyLimit(uint256 _foreignDailyLimit) public onlyOwner {
        require(_foreignDailyLimit > 0);
        foreignDailyLimit = _foreignDailyLimit;
        DailyLimit(foreignDailyLimit);
    }

    function withinLimit(uint256 _amount) public view returns(bool) {
        uint256 nextLimit = totalSpentPerDay[getCurrentDay()].add(_amount);
        return foreignDailyLimit >= nextLimit;
    }

}
