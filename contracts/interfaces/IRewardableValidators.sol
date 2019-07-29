pragma solidity 0.4.24;

interface IRewardableValidators {
    function isValidator(address _validator) external view returns (bool);
    function requiredSignatures() external view returns (uint256);
    function owner() external view returns (address);
    function validatorList() external view returns (address[]);
    function getValidatorRewardAddress(address _validator) external view returns (address);
    function validatorCount() external view returns (uint256);
    function getNextValidator(address _address) external view returns (address);
}
