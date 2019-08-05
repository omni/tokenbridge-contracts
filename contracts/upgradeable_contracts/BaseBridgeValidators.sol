pragma solidity 0.4.24;

import "./Ownable.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "./Initializable.sol";

contract BaseBridgeValidators is Initializable, Ownable {
    using SafeMath for uint256;

    address public constant F_ADDR = 0xFFfFfFffFFfffFFfFFfFFFFFffFFFffffFfFFFfF;
    uint256 internal constant MAX_VALIDATORS = 100;
    bytes32 internal constant REQUIRED_SIGNATURES = keccak256(abi.encodePacked("requiredSignatures"));
    bytes32 internal constant VALIDATOR_COUNT = keccak256(abi.encodePacked("validatorCount"));

    event ValidatorAdded(address indexed validator);
    event ValidatorRemoved(address indexed validator);
    event RequiredSignaturesChanged(uint256 requiredSignatures);

    function setRequiredSignatures(uint256 _requiredSignatures) external onlyOwner {
        require(validatorCount() >= _requiredSignatures);
        require(_requiredSignatures != 0);
        uintStorage[REQUIRED_SIGNATURES] = _requiredSignatures;
        emit RequiredSignaturesChanged(_requiredSignatures);
    }

    function getBridgeValidatorsInterfacesVersion() external pure returns (uint64 major, uint64 minor, uint64 patch) {
        return (2, 2, 0);
    }

    function validatorList() external view returns (address[]) {
        address[] memory list = new address[](validatorCount());
        uint256 counter = 0;
        address nextValidator = getNextValidator(F_ADDR);
        require(nextValidator != address(0));

        while (nextValidator != F_ADDR) {
            list[counter] = nextValidator;
            nextValidator = getNextValidator(nextValidator);
            counter++;

            require(nextValidator != address(0));
        }

        return list;
    }

    function _addValidator(address _validator) internal {
        require(_validator != address(0) && _validator != F_ADDR);
        require(!isValidator(_validator));

        address firstValidator = getNextValidator(F_ADDR);
        require(firstValidator != address(0));
        setNextValidator(_validator, firstValidator);
        setNextValidator(F_ADDR, _validator);
        setValidatorCount(validatorCount().add(1));
    }

    function _removeValidator(address _validator) internal {
        require(validatorCount() > requiredSignatures());
        require(isValidator(_validator));
        address validatorsNext = getNextValidator(_validator);
        address index = F_ADDR;
        address next = getNextValidator(index);
        require(next != address(0));

        while (next != _validator) {
            index = next;
            next = getNextValidator(index);

            require(next != F_ADDR && next != address(0));
        }

        setNextValidator(index, validatorsNext);
        deleteItemFromAddressStorage("validatorsList", _validator);
        setValidatorCount(validatorCount().sub(1));
    }

    function requiredSignatures() public view returns (uint256) {
        return uintStorage[REQUIRED_SIGNATURES];
    }

    function validatorCount() public view returns (uint256) {
        return uintStorage[VALIDATOR_COUNT];
    }

    function isValidator(address _validator) public view returns (bool) {
        return _validator != F_ADDR && getNextValidator(_validator) != address(0);
    }

    function getNextValidator(address _address) public view returns (address) {
        return addressStorage[keccak256(abi.encodePacked("validatorsList", _address))];
    }

    function deleteItemFromAddressStorage(string _mapName, address _address) internal {
        delete addressStorage[keccak256(abi.encodePacked(_mapName, _address))];
    }

    function setValidatorCount(uint256 _validatorCount) internal {
        uintStorage[VALIDATOR_COUNT] = _validatorCount;
    }

    function setNextValidator(address _prevValidator, address _validator) internal {
        addressStorage[keccak256(abi.encodePacked("validatorsList", _prevValidator))] = _validator;
    }
}
