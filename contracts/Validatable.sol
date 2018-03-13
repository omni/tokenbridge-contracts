pragma solidity ^0.4.19;
import "./IBridgeValidators.sol";


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
