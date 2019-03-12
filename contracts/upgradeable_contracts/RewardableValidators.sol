pragma solidity 0.4.19;

import "./BaseBridgeValidators.sol";


contract RewardableValidators is BaseBridgeValidators {

    event ValidatorAdded (address indexed validator, address reward);
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
                setNextValidator(F_ADDR, _initialValidators[i]);
                if (_initialValidators.length == 1) {
                    setNextValidator(_initialValidators[i], F_ADDR);
                }
            } else if (i == _initialValidators.length - 1) {
                setNextValidator(_initialValidators[i - 1], _initialValidators[i]);
                setNextValidator(_initialValidators[i], F_ADDR);
            } else {
                setNextValidator(_initialValidators[i - 1], _initialValidators[i]);
            }

            setValidatorCount(validatorCount().add(1));
            setValidatorRewardAddress(_initialValidators[i], _initialRewards[i]);
            ValidatorAdded(_initialValidators[i], _initialRewards[i]);
        }

        uintStorage[keccak256("requiredSignatures")] = _requiredSignatures;
        uintStorage[keccak256("deployedAtBlock")] = block.number;
        setInitialize(true);
        RequiredSignaturesChanged(_requiredSignatures);

        return isInitialized();
    }

    function addValidator(address _validator, address _reward) external onlyOwner {
        require(_reward != address(0));
        _addValidator(_validator);
        setValidatorRewardAddress(_validator, _reward);
        ValidatorAdded(_validator, _reward);
    }

    function removeValidator(address _validator) external onlyOwner {
        _removeValidator(_validator);
        deleteItemFromAddressStorage("validatorsRewards", _validator);
        ValidatorRemoved(_validator);
    }

    function validatorList() public view returns (address[]) {
        address [] memory list = new address[](validatorCount());
        uint256 counter = 0;
        address nextValidator = getNextValidator(F_ADDR);
        require(nextValidator != address(0));

        while (nextValidator != F_ADDR) {
            list[counter] = nextValidator;
            nextValidator = getNextValidator(nextValidator);
            counter++;

            if (nextValidator == address(0) ) {
                revert();
            }
        }

        return list;
    }

    function getValidatorRewardAddress(address _validator) public view returns (address) {
        return addressStorage[keccak256("validatorsRewards", _validator)];
    }

    function setValidatorRewardAddress(address _validator, address _reward) internal {
        addressStorage[keccak256("validatorsRewards", _validator)] = _reward;
    }
}
