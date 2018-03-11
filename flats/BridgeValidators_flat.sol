pragma solidity ^0.4.19;

// File: contracts/IBridgeValidators.sol

interface IBridgeValidators {
    function isValidator(address _validator) public view returns(bool);
    function requiredSignatures() public view returns(uint8);
    function currentOwner() public view returns(address);
}

// File: zeppelin-solidity/contracts/ownership/Ownable.sol

/**
 * @title Ownable
 * @dev The Ownable contract has an owner address, and provides basic authorization control
 * functions, this simplifies the implementation of "user permissions".
 */
contract Ownable {
  address public owner;


  event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);


  /**
   * @dev The Ownable constructor sets the original `owner` of the contract to the sender
   * account.
   */
  function Ownable() public {
    owner = msg.sender;
  }

  /**
   * @dev Throws if called by any account other than the owner.
   */
  modifier onlyOwner() {
    require(msg.sender == owner);
    _;
  }

  /**
   * @dev Allows the current owner to transfer control of the contract to a newOwner.
   * @param newOwner The address to transfer ownership to.
   */
  function transferOwnership(address newOwner) public onlyOwner {
    require(newOwner != address(0));
    OwnershipTransferred(owner, newOwner);
    owner = newOwner;
  }

}

// File: contracts/BridgeValidators.sol

contract BridgeValidators is Ownable, IBridgeValidators {

  // Event created on validator gets added
    event ValidatorAdded (address validator);
    event ValidatorRemoved (address validator);
    uint8 requiredValidators = 0;
    uint256 public validatorCount = 0;

    mapping (address => bool) public validators;

    function BridgeValidators(uint8 _requiredValidators, address[] _initialValidators) public Ownable() {
        require(_requiredValidators != 0);
        require(_initialValidators.length >= _requiredValidators);
        validatorCount = _initialValidators.length;
        for (uint i = 0; i < _initialValidators.length; i++) {
            require(!isValidator(_initialValidators[i]) && _initialValidators[i] != address(0));
            addValidator(_initialValidators[i]);
        }
        setRequiredValidators(_requiredValidators);
    }

    function addValidator(address _validator)  public onlyOwner {
        assert(validators[_validator] != true);
        validatorCount++;
        validators[_validator] = true;
        ValidatorAdded(_validator);
    }

    function removeValidator(address _validator) public onlyOwner {
        require(validatorCount > requiredValidators);
        validators[_validator] = false;
        validatorCount--;
        ValidatorRemoved(_validator);
    }

    function setRequiredValidators(uint8 _requiredValidators) public onlyOwner {
        require(validatorCount >= _requiredValidators);
        requiredValidators = _requiredValidators;
    }

    function isValidator(address _validator) public view returns(bool) {
        return validators[_validator] == true;
    }

    function requiredSignatures() public view returns(uint8) {
        return requiredValidators;
    }

    function currentOwner() public view returns(address) {
        return owner;
    }
}
