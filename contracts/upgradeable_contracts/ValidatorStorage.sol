pragma solidity 0.4.24;

contract ValidatorStorage {
    bytes32 internal constant VALIDATOR_CONTRACT = keccak256(abi.encodePacked("validatorContract"));
}
