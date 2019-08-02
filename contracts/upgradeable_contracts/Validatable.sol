pragma solidity 0.4.24;
import "../interfaces/IBridgeValidators.sol";
import "../upgradeability/EternalStorage.sol";

contract Validatable is EternalStorage {
    bytes32 internal constant VALIDATOR_CONTRACT = keccak256(abi.encodePacked("validatorContract"));

    function validatorContract() public view returns (IBridgeValidators) {
        return IBridgeValidators(addressStorage[VALIDATOR_CONTRACT]);
    }

    modifier onlyValidator() {
        require(validatorContract().isValidator(msg.sender));
        /* solcov ignore next */
        _;
    }

    function requiredSignatures() public view returns (uint256) {
        return validatorContract().requiredSignatures();
    }

}
