pragma solidity 0.4.24;

interface IValidatorSetContract {
    function isValidator(address _validator) external view returns (bool);
}
