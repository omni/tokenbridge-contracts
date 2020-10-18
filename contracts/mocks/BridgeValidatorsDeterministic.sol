pragma solidity 0.4.24;

import "../upgradeable_contracts/BridgeValidators.sol";

contract BridgeValidatorsDeterministic is BridgeValidators {
    function isValidatorDuty(address _validator) external view returns (bool) {
        // first validator is always on duty, others are always not
        return _validator == _addressByIndex(0);
    }
}
