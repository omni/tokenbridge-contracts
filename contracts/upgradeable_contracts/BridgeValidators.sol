pragma solidity 0.4.24;

import "./BaseBridgeValidators.sol";


contract BridgeValidators is BaseBridgeValidators {

    function initialize(
        uint256 _requiredSignatures,
        address[] _initialValidators,
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

        for (uint256 i = 0; i < _initialValidators.length; i++) {
            require(_initialValidators[i] != address(0) && _initialValidators[i] != F_ADDR);
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
            emit ValidatorAdded(_initialValidators[i]);
        }

        uintStorage[keccak256(abi.encodePacked("requiredSignatures"))] = _requiredSignatures;
        uintStorage[keccak256("deployedAtBlock")] = block.number;
        setInitialize(true);
        emit RequiredSignaturesChanged(_requiredSignatures);

        return isInitialized();
    }

    function addValidator(address _validator) external onlyOwner {
        _addValidator(_validator);
        emit ValidatorAdded(_validator);
    }

    function removeValidator(address _validator) external onlyOwner {
        _removeValidator(_validator);
        emit ValidatorRemoved(_validator);
    }
}
