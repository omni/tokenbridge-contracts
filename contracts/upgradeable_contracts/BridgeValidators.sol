pragma solidity 0.4.24;

import "./Ownable.sol";
import "../IBridgeValidators.sol";
import "../libraries/SafeMath.sol";
import "../upgradeability/EternalStorage.sol";


contract BridgeValidators is IBridgeValidators, EternalStorage, Ownable {
    using SafeMath for uint256;
    event ValidatorAdded (address validator);
    event ValidatorRemoved (address validator);
    event RequiredSignaturesChanged (uint256 requiredSignatures);

    function initialize(uint256 _requiredSignatures, address[] _initialValidators, address _owner)
      public returns(bool)
    {
        require(!isInitialized());
        require(_owner != address(0));
        setOwner(_owner);
        require(_requiredSignatures != 0);
        require(_initialValidators.length >= _requiredSignatures);
        for (uint256 i = 0; i < _initialValidators.length; i++) {
            require(_initialValidators[i] != address(0));
            assert(validators(_initialValidators[i]) != true);
            setValidatorCount(validatorCount().add(1));
            setValidator(_initialValidators[i], true);
            emit ValidatorAdded(_initialValidators[i]);
        }
        uintStorage[keccak256(abi.encodePacked("requiredSignatures"))] = _requiredSignatures;
        setInitialize(true);
        emit RequiredSignaturesChanged(_requiredSignatures);
        return isInitialized();
    }

    function addValidator(address _validator) external onlyOwner {
        require(_validator != address(0));
        require(!isValidator(_validator));
        setValidatorCount(validatorCount().add(1));
        setValidator(_validator, true);
        emit ValidatorAdded(_validator);
    }

    function removeValidator(address _validator) external onlyOwner {
        require(validatorCount() > requiredSignatures());
        require(isValidator(_validator));
        setValidator(_validator, false);
        setValidatorCount(validatorCount().sub(1));
        emit ValidatorRemoved(_validator);
    }

    function setRequiredSignatures(uint256 _requiredSignatures) external onlyOwner {
        require(validatorCount() >= _requiredSignatures);
        require(_requiredSignatures != 0);
        uintStorage[keccak256(abi.encodePacked("requiredSignatures"))] = _requiredSignatures;
        emit RequiredSignaturesChanged(_requiredSignatures);
    }

    function requiredSignatures() public view returns(uint256) {
        return uintStorage[keccak256(abi.encodePacked("requiredSignatures"))];
    }

    function validatorCount() public view returns(uint256) {
        return uintStorage[keccak256(abi.encodePacked("validatorCount"))];
    }

    function validators(address _validator) public view returns(bool) {
        return boolStorage[keccak256(abi.encodePacked("validators", _validator))];
    }

    function isValidator(address _validator) public view returns(bool) {
        return validators(_validator) == true;
    }

    function isInitialized() public view returns(bool) {
        return boolStorage[keccak256(abi.encodePacked("isInitialized"))];
    }

    function setValidatorCount(uint256 _validatorCount) private {
        uintStorage[keccak256(abi.encodePacked("validatorCount"))] = _validatorCount;
    }

    function setValidator(address _validator, bool _status) private {
        boolStorage[keccak256(abi.encodePacked("validators", _validator))] = _status;
    }

    function setInitialize(bool _status) private {
        boolStorage[keccak256(abi.encodePacked("isInitialized"))] = _status;
    }
}
