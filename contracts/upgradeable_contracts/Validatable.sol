pragma solidity 0.4.23;
import "../IBridgeValidators.sol";
import "../upgradeability/EternalStorage.sol";


contract Validatable is EternalStorage {

    function validatorContract() public view returns(IBridgeValidators) {
        return IBridgeValidators(addressStorage[keccak256("validatorContract")]);
    }

    modifier onlyValidator() {
        require(validatorContract().isValidator(msg.sender));
        _;
    }
}
