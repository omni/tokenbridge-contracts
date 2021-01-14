pragma solidity 0.4.24;

import "./BaseBridgeValidators.sol";

contract RewardableValidators is BaseBridgeValidators {
    function initialize(
        uint256 _requiredSignatures,
        address[] _initialValidators,
        address[] _initialRewards,
        address _owner
    ) external onlyRelevantSender returns (bool) {
        require(!isInitialized());
        _setOwner(_owner);
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

            setValidatorRewardAddress(_initialValidators[i], _initialRewards[i]);
            emit ValidatorAdded(_initialValidators[i]);
        }

        setValidatorCount(_initialValidators.length);
        uintStorage[REQUIRED_SIGNATURES] = _requiredSignatures;
        uintStorage[DEPLOYED_AT_BLOCK] = block.number;
        setInitialize();
        emit RequiredSignaturesChanged(_requiredSignatures);

        return isInitialized();
    }

    function addRewardableValidator(address _validator, address _reward) external onlyOwner {
        require(_reward != address(0));
        _addValidator(_validator);
        setValidatorRewardAddress(_validator, _reward);
        emit ValidatorAdded(_validator);
    }

    function removeValidator(address _validator) external onlyOwner {
        _removeValidator(_validator);
        deleteItemFromAddressStorage("validatorsRewards", _validator);
        emit ValidatorRemoved(_validator);
    }

    function getValidatorRewardAddress(address _validator) external view returns (address) {
        return addressStorage[keccak256(abi.encodePacked("validatorsRewards", _validator))];
    }

    function setValidatorRewardAddress(address _validator, address _reward) internal {
        addressStorage[keccak256(abi.encodePacked("validatorsRewards", _validator))] = _reward;
    }
}
