pragma solidity ^0.4.19;
import "../IBridgeValidators.sol";
import "../upgradeability/OwnedUpgradeabilityStorage.sol";


contract Validatable is OwnedUpgradeabilityStorage {

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
