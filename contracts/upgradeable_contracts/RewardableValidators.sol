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
        require(_initialValidators.length >= _requiredSignatures);
        require(_initialValidators.length == _initialRewards.length);

        _initAddresses(_initialValidators);
        for (uint256 i = 0; i < _initialValidators.length; i++) {
            require(_initialRewards[i] != address(0));
            _setValidatorRewardAddress(_initialValidators[i], _initialRewards[i]);
        }

        _setRequiredSignatures(_requiredSignatures);
        _setOwner(_owner);

        setInitialize();

        return isInitialized();
    }

    function getValidatorRewardAddress(address _validator) external view returns (address) {
        return addressStorage[keccak256(abi.encodePacked("validatorsRewards", _validator))];
    }

    function addRewardableValidator(address _validator, address _reward) external onlyOwner {
        require(_reward != address(0));

        _addAddress(_validator);
        _setValidatorRewardAddress(_validator, _reward);

        emit ValidatorAdded(_validator);
    }

    function removeValidator(address _validator) external onlyOwner {
        uint256 count = _removeAddress(_validator);
        require(count >= requiredSignatures());

        _setValidatorRewardAddress(_validator, address(0));

        emit ValidatorRemoved(_validator);
    }

    function _setValidatorRewardAddress(address _validator, address _reward) internal {
        addressStorage[keccak256(abi.encodePacked("validatorsRewards", _validator))] = _reward;
    }
}
