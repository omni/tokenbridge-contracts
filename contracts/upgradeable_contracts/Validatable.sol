pragma solidity 0.4.23;
import "../IBridgeValidators.sol";
import "../upgradeability/EternalStorage.sol";
import "./Ownable.sol";
import "../upgradeability/OwnedUpgradeabilityProxy.sol";


contract Validatable is EternalStorage, Ownable, OwnedUpgradeabilityProxy {

    function validatorContract() public view returns(IBridgeValidators) {
        return IBridgeValidators(addressStorage[keccak256("validatorContract")]);
    }

    modifier onlyValidator() {
        require(validatorContract().isValidator(msg.sender));
        _;
    }
}
