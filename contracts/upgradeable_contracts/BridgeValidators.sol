pragma solidity 0.4.24;

import "./Ownable.sol";
import "../IBridgeValidators.sol";
import "../libraries/SafeMath.sol";
import "../upgradeability/EternalStorage.sol";


contract BridgeValidators is IBridgeValidators, EternalStorage, Ownable {
    using SafeMath for uint256;

    address constant F_ADDR = 0xFFfFfFffFFfffFFfFFfFFFFFffFFFffffFfFFFfF;

    event ValidatorAdded (address indexed validator);
    event ValidatorRemoved (address indexed validator);
    event RequiredSignaturesChanged (uint256 requiredSignatures);

    function initialize(
        uint256 _requiredSignatures,
        address[] _initialValidators,
        address[] _initialRewards,
        address _owner
    )
        public
        returns (bool)
    {
        require(!isInitialized());
        require(_owner != address(0));
        setOwner(_owner);
        require(_requiredSignatures != 0);
        require(_initialValidators.length >= _requiredSignatures);
        require(_initialValidators.length == _initialRewards.length);

        for (uint256 i = 0; i < _initialValidators.length; i++) {
            require(_initialValidators[i] != address(0) && _initialValidators[i] != F_ADDR);
            require(_initialRewards[i] != address(0));
            require(!isValidator(_initialValidators[i]));

            if (i == 0) {
                setValidator(F_ADDR, _initialValidators[i]);
                if (_initialValidators.length == 1) {
                    setValidator(_initialValidators[i], F_ADDR);
                }
            } else if (i == _initialValidators.length - 1) {
                setValidator(_initialValidators[i - 1], _initialValidators[i]);
                setValidator(_initialValidators[i], F_ADDR);
            } else {
                setValidator(_initialValidators[i - 1], _initialValidators[i]);
            }

            setValidatorCount(validatorCount().add(1));
            setValidatorRewardAddress(_initialValidators[i], _initialRewards[i]);
            emit ValidatorAdded(_initialValidators[i]);
        }

        uintStorage[keccak256(abi.encodePacked("requiredSignatures"))] = _requiredSignatures;
        uintStorage[keccak256("deployedAtBlock")] = block.number;
        setInitialize(true);
        emit RequiredSignaturesChanged(_requiredSignatures);

        return isInitialized();
    }

    function addValidator(address _validator, address _reward) external onlyOwner {
        require(_validator != address(0) && _validator != F_ADDR);
        require(_reward != address(0));
        require(!isValidator(_validator));

        address firstValidator = getNextValidator(F_ADDR);
        setValidator(_validator, firstValidator);
        setValidatorRewardAddress(_validator, _reward);
        setValidator(F_ADDR, _validator);

        setValidatorCount(validatorCount().add(1));
        emit ValidatorAdded(_validator);
    }

    function removeValidator(address _validator) external onlyOwner {
        require(validatorCount() > requiredSignatures());
        require(isValidator(_validator));
        address validatorsNext = getNextValidator(_validator);
        address index = F_ADDR;
        address next = getNextValidator(index);

        // find the element in the list pointing to _validator
        while (next != _validator) {
            index = next;
            next = getNextValidator(index);
        }

        setValidator(index, validatorsNext);
        deleteItemFromAddressStorage("validatorsList", _validator);
        deleteItemFromAddressStorage("validatorsRewards", _validator);
        setValidatorCount(validatorCount().sub(1));

        emit ValidatorRemoved(_validator);
    }

    function setRequiredSignatures(uint256 _requiredSignatures)
        external
        onlyOwner
    {
        require(validatorCount() >= _requiredSignatures);
        require(_requiredSignatures != 0);
        uintStorage[keccak256(abi.encodePacked("requiredSignatures"))] = _requiredSignatures;
        emit RequiredSignaturesChanged(_requiredSignatures);
    }

    function getBridgeValidatorsInterfacesVersion()
        public
        pure
        returns (uint64 major, uint64 minor, uint64 patch)
    {
        return (2, 0, 0);
    }

    function requiredSignatures() public view returns (uint256) {
        return uintStorage[keccak256(abi.encodePacked("requiredSignatures"))];
    }

    function validatorCount() public view returns (uint256) {
        return uintStorage[keccak256(abi.encodePacked("validatorCount"))];
    }

    function isValidator(address _validator) public view returns (bool) {
        return _validator != F_ADDR && getNextValidator(_validator) != address(0);
    }

    function isInitialized() public view returns (bool) {
        return boolStorage[keccak256(abi.encodePacked("isInitialized"))];
    }

    function deployedAtBlock() public view returns (uint256) {
        return uintStorage[keccak256("deployedAtBlock")];
    }

    function getValidatorRewardAddress(address _validator) public view returns (address) {
        return addressStorage[keccak256(abi.encodePacked("validatorsRewards", _validator))];
    }

    function getNextValidator(address _address) internal view returns (address) {
        return addressStorage[keccak256(abi.encodePacked("validatorsList", _address))];
    }

    function setValidatorRewardAddress(address _validator, address _reward) internal {
        addressStorage[keccak256(abi.encodePacked("validatorsRewards", _validator))] = _reward;
    }

    function deleteItemFromAddressStorage(string _mapName, address _address) private {
        delete addressStorage[keccak256(abi.encodePacked(_mapName, _address))];
    }

    function setValidatorCount(uint256 _validatorCount) private {
        uintStorage[keccak256(abi.encodePacked("validatorCount"))] = _validatorCount;
    }

    function setValidator(address _prevValidator, address _validator) private {
        addressStorage[keccak256(abi.encodePacked("validatorsList", _prevValidator))] = _validator;
    }

    function setInitialize(bool _status) private {
        boolStorage[keccak256(abi.encodePacked("isInitialized"))] = _status;
    }
}
