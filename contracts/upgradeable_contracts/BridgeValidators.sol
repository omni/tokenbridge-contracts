pragma solidity 0.4.24;

import "./BaseBridgeValidators.sol";

/**
 * @title BridgeValidators
 * Upgradeable contract for managing dynamic list of validators.
 */
contract BridgeValidators is BaseBridgeValidators {
    /**
     * @dev Initializes the validators contract with the initial list of validators.
     * @param _requiredSignatures initial value for the required signatures.
     * @param _initialValidators array with the initial validators addresses.
     * @param _owner address of the contract owner.
     */
    function initialize(uint256 _requiredSignatures, address[] _initialValidators, address _owner)
        external
        onlyRelevantSender
        returns (bool)
    {
        require(!isInitialized());

        _initAddresses(_initialValidators);
        for (uint256 i = 0; i < _initialValidators.length; i++) {
            emit ValidatorAdded(_initialValidators[i]);
        }

        _setRequiredSignatures(_requiredSignatures);
        _setOwner(_owner);

        setInitialize();

        return isInitialized();
    }

    /**
     * @dev Adds a new validator.
     * Only owner can call this method.
     * @param _validator address of the new validator.
     */
    function addValidator(address _validator) external onlyOwner {
        _addAddress(_validator);

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

        emit ValidatorRemoved(_validator);
    }
}
