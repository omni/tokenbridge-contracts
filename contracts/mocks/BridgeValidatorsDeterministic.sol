pragma solidity 0.4.24;

import "../upgradeable_contracts/BridgeValidators.sol";

contract BridgeValidatorsDeterministic is BridgeValidators {
    function isValidatorDuty(address _validator) external view returns (bool) {
        address next = getNextValidator(F_ADDR);
        require(next != address(0));

        // first validator is always on duty, others are always not
        return _validator == next;
    }
}
