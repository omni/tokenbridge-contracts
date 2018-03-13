pragma solidity ^0.4.19;

import "./Ownable.sol";
import "../IBridgeValidators.sol";
import "../libraries/SafeMath.sol";
import "../upgradeability/OwnedUpgradeabilityStorage.sol";


contract BridgeValidators is IBridgeValidators, Ownable, OwnedUpgradeabilityStorage {
    using SafeMath for uint256;
    event ValidatorAdded (address validator);
    event ValidatorRemoved (address validator);

    function BridgeValidators(uint8 _requiredSignatures, address[] _initialValidators) public Ownable() {
        require(_requiredSignatures != 0);
        require(_initialValidators.length >= _requiredSignatures);
        setValidatorCount(_initialValidators.length);
        for (uint i = 0; i < _initialValidators.length; i++) {
            require(!isValidator(_initialValidators[i]) && _initialValidators[i] != address(0));
            addValidator(_initialValidators[i]);
        }
        setRequiredSignatures(_requiredSignatures);
    }

    function addValidator(address _validator) public onlyOwner {
        assert(validators(_validator) != true);
        setValidatorCount(validatorCount().add(1));
        setValidator(_validator, true);
        ValidatorAdded(_validator);
    }

    function removeValidator(address _validator) public onlyOwner {
        require(validatorCount() > requiredSignatures());
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

    function setValidatorCount(uint256 _validatorCount) private {
        uintStorage[keccak256("validatorCount")] = _validatorCount;
    }

    function setValidator(address _validator, bool _status) private {
        boolStorage[keccak256("validators", _validator)] = _status;
    }
}
