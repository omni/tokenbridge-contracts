pragma solidity 0.4.24;

import "./Initializable.sol";

contract InitializableBridge is Initializable {
    bytes32 internal constant DEPLOYED_AT_BLOCK = keccak256(abi.encodePacked("deployedAtBlock"));

    function deployedAtBlock() external view returns (uint256) {
        return uintStorage[DEPLOYED_AT_BLOCK];
    }
}
