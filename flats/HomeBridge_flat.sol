pragma solidity 0.4.19;

// File: contracts/IBridgeValidators.sol

interface IBridgeValidators {
    function isValidator(address _validator) public view returns(bool);
    function requiredSignatures() public view returns(uint256);
    function owner() public view returns(address);
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
        uint256 requiredSignatures = _validatorContract.requiredSignatures();
        require(_vs.length >= requiredSignatures);
        bytes32 hash = MessageSigning.hashMessage(_message);
        address[] memory encounteredAddresses = new address[](requiredSignatures);

        for (uint256 i = 0; i < requiredSignatures; i++) {
            address recoveredAddress = ecrecover(hash, _vs[i], _rs[i], _ss[i]);
            require(_validatorContract.isValidator(recoveredAddress));
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

// File: contracts/upgradeability/EternalStorage.sol

/**
 * @title EternalStorage
 * @dev This contract holds all the necessary state variables to carry out the storage of any contract.
 */
contract EternalStorage {

    mapping(bytes32 => uint256) internal uintStorage;
    mapping(bytes32 => string) internal stringStorage;
    mapping(bytes32 => address) internal addressStorage;
    mapping(bytes32 => bytes) internal bytesStorage;
    mapping(bytes32 => bool) internal boolStorage;
    mapping(bytes32 => int256) internal intStorage;

}

// File: contracts/upgradeable_contracts/U_Validatable.sol

contract Validatable is EternalStorage {

    function validatorContract() public view returns(IBridgeValidators) {
        return IBridgeValidators(addressStorage[keccak256("validatorContract")]);
    }

    modifier onlyValidator() {
        require(validatorContract().isValidator(msg.sender));
        _;
    }

    modifier onlyOwner() {
        require(validatorContract().owner() == msg.sender);
        _;
    }

}

// File: contracts/upgradeable_contracts/U_HomeBridge.sol

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
    ) public {
        require(!isInitialized());
        require(_validatorContract != address(0));
        require(_minPerTx > 0 && _maxPerTx > _minPerTx);
        addressStorage[keccak256("validatorContract")] = _validatorContract;
        uintStorage[keccak256("deployedAtBlock")] = block.number;
        setHomeDailyLimit(_homeDailyLimit);
        setMaxPerTx(_maxPerTx);
        setMinPerTx(_minPerTx);
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
        setWithdraws(hash, true);

        // pay out recipient
        recipient.transfer(value);

        Withdraw(recipient, value, hash);
    }

    function setHomeDailyLimit(uint256 _homeDailyLimit) public onlyOwner {
        uintStorage[keccak256("homeDailyLimit")] = _homeDailyLimit;
        DailyLimit(_homeDailyLimit);
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
