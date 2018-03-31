pragma solidity 0.4.19;

// File: contracts/IBridgeValidators.sol

interface IBridgeValidators {
    function isValidator(address _validator) public view returns(bool);
    function requiredSignatures() public view returns(uint256);
    function owner() public view returns(address);
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

// File: contracts/upgradeable_contracts/Ownable.sol

// Roman Storm Multi Sender
// To Use this Dapp: https://poanetwork.github.io/multisender
pragma solidity 0.4.19;



/**
 * @title Ownable
 * @dev This contract has an owner address providing basic authorization control
 */
contract Ownable is EternalStorage {
    /**
    * @dev Event to show ownership has been transferred
    * @param previousOwner representing the address of the previous owner
    * @param newOwner representing the address of the new owner
    */
    event OwnershipTransferred(address previousOwner, address newOwner);

    /**
    * @dev Throws if called by any account other than the owner.
    */
    modifier onlyOwner() {
        require(msg.sender == owner());
        _;
    }

    /**
    * @dev Tells the address of the owner
    * @return the address of the owner
    */
    function owner() public view returns (address) {
        return addressStorage[keccak256("owner")];
    }

    /**
    * @dev Allows the current owner to transfer control of the contract to a newOwner.
    * @param newOwner the address to transfer ownership to.
    */
    function transferOwnership(address newOwner) public onlyOwner {
        require(newOwner != address(0));
        setOwner(newOwner);
    }

    /**
    * @dev Sets a new owner address
    */
    function setOwner(address newOwner) internal {
        OwnershipTransferred(owner(), newOwner);
        addressStorage[keccak256("owner")] = newOwner;
    }
}

// File: contracts/upgradeable_contracts/U_BridgeValidators.sol

contract BridgeValidators is IBridgeValidators, EternalStorage, Ownable {
    using SafeMath for uint256;
    event ValidatorAdded (address validator);
    event ValidatorRemoved (address validator);

    function initialize(uint256 _requiredSignatures, address[] _initialValidators, address _owner) public {
        require(!isInitialized());
        setOwner(_owner);
        require(_requiredSignatures != 0);
        require(_initialValidators.length >= _requiredSignatures);
        for (uint i = 0; i < _initialValidators.length; i++) {
            require(!isValidator(_initialValidators[i]) && _initialValidators[i] != address(0));
            addValidator(_initialValidators[i]);
        }
        setRequiredSignatures(_requiredSignatures);
        setInitialize(true);
    }

    function addValidator(address _validator) public onlyOwner {
        require(_validator != address(0));
        assert(validators(_validator) != true);
        setValidatorCount(validatorCount().add(1));
        setValidator(_validator, true);
        ValidatorAdded(_validator);
    }

    function removeValidator(address _validator) public onlyOwner {
        require(validatorCount() > requiredSignatures());
        require(isValidator(_validator));
        setValidator(_validator, false);
        setValidatorCount(validatorCount().sub(1));
        ValidatorRemoved(_validator);
    }

    function setRequiredSignatures(uint256 _requiredSignatures) public onlyOwner {
        require(validatorCount() >= _requiredSignatures);
        uintStorage[keccak256("requiredSignatures")] = _requiredSignatures;
    }

    function requiredSignatures() public view returns(uint256) {
        return uintStorage[keccak256("requiredSignatures")];
    }

    function validatorCount() public view returns(uint256) {
        return uintStorage[keccak256("validatorCount")];
    }

    function validators(address _validator) public view returns(bool) {
        return boolStorage[keccak256("validators", _validator)];
    }

    function isValidator(address _validator) public view returns(bool) {
        return validators(_validator) == true;
    }

    function isInitialized() public view returns(bool) {
        return boolStorage[keccak256("isInitialized")];
    }

    function setValidatorCount(uint256 _validatorCount) private {
        uintStorage[keccak256("validatorCount")] = _validatorCount;
    }

    function setValidator(address _validator, bool _status) private {
        boolStorage[keccak256("validators", _validator)] = _status;
    }

    function setInitialize(bool _status) private {
        boolStorage[keccak256("isInitialized")] = _status;
    }
}
