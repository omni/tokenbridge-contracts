pragma solidity 0.4.24;

import "./BaseBridgeValidators.sol";


contract RewardableValidators is BaseBridgeValidators {

    event ValidatorAdded (address indexed validator);
    event ValidatorRemoved (address indexed validator);

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

    function getValidatorRewardAddress(address _validator) public view returns (address) {
        return addressStorage[keccak256(abi.encodePacked("validatorsRewards", _validator))];
    }

    function setValidatorRewardAddress(address _validator, address _reward) internal {
        addressStorage[keccak256(abi.encodePacked("validatorsRewards", _validator))] = _reward;
    }
}
