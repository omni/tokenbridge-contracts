pragma solidity 0.4.24;

import "./BaseBridgeValidators.sol";

/**
 * @title RewardableValidators
 * Upgradeable contract for managing dynamic list of validators together with their reward addresses.
 */
contract RewardableValidators is BaseBridgeValidators {
    /**
     * @dev Initializes the validators contract with the initial list of validators and their reward addreses.
     * @param _requiredSignatures initial value for the required signatures.
     * @param _initialValidators array with the initial validators addresses.
     * @param _initialRewards array with the initial reward addresses.
     * @param _owner address of the contract owner.
     */
    function initialize(
        uint256 _requiredSignatures,
        address[] _initialValidators,
        address[] _initialRewards,
        address _owner
    ) external onlyRelevantSender returns (bool) {
        require(!isInitialized());
        require(_initialValidators.length == _initialRewards.length);

        _initAddresses(_initialValidators);
        for (uint256 i = 0; i < _initialValidators.length; i++) {
            require(_initialRewards[i] != address(0));
            _setValidatorRewardAddress(_initialValidators[i], _initialRewards[i]);
            emit ValidatorAdded(_initialValidators[i]);
        }

        _setRequiredSignatures(_requiredSignatures);
        _setOwner(_owner);

        setInitialize();

        return isInitialized();
    }

    /**
     * @dev Tells the reward address of some particular validator.
     * @param _validator address of the requested validator.
     * @return associated reward address.
     */
    function getValidatorRewardAddress(address _validator) external view returns (address) {
        return addressStorage[keccak256(abi.encodePacked("validatorsRewards", _validator))];
    }

    /**
     * @dev Adds a new rewardable validator to the contract.
     * Only owner can call this method.
     * @param _validator address of the new validator.
     * @param _reward validor address where all rewards will be sent to.
     */
    function addRewardableValidator(address _validator, address _reward) external onlyOwner {
        require(_reward != address(0));

        _addAddress(_validator);
        _setValidatorRewardAddress(_validator, _reward);

        emit ValidatorAdded(_validator);
    }

    /**
     * @dev Removes an old validator from the list.
     * Only owner can call this method.
     * @param _validator validator address to be removed.
     */
    function removeValidator(address _validator) external onlyOwner {
        uint256 count = _removeAddress(_validator);
        require(count >= requiredSignatures());

        _setValidatorRewardAddress(_validator, address(0));

        emit ValidatorRemoved(_validator);
    }

    /**
     * @dev Internal function for setting associated reward address for some particular validator.
     * @param _validator address of the validator for which reward address is set.
     * @param _reward new reward address.
     */
    function _setValidatorRewardAddress(address _validator, address _reward) internal {
        addressStorage[keccak256(abi.encodePacked("validatorsRewards", _validator))] = _reward;
    }
}
