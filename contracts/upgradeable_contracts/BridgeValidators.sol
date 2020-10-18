pragma solidity 0.4.24;

import "./BaseBridgeValidators.sol";

contract BridgeValidators is BaseBridgeValidators {
    function initialize(uint256 _requiredSignatures, address[] _initialValidators, address _owner)
        external
        onlyRelevantSender
        returns (bool)
    {
        require(!isInitialized());
        require(_initialValidators.length >= _requiredSignatures);

        _setRequiredSignatures(_requiredSignatures);
        _initAddresses(_initialValidators);
        _setOwner(_owner);

        setInitialize();

        return isInitialized();
    }

    function addValidator(address _validator) external onlyOwner {
        _addAddress(_validator);

        emit ValidatorAdded(_validator);
    }

    function removeValidator(address _validator) external onlyOwner {
        uint256 count = _removeAddress(_validator);
        require(count >= requiredSignatures());

        emit ValidatorRemoved(_validator);
    }
}
