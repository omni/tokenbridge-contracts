pragma solidity 0.4.24;

import "./Initializable.sol";

contract InitializableBridge is Initializable {
    bytes32 internal constant DEPLOYED_AT_BLOCK = 0xb120ceec05576ad0c710bc6e85f1768535e27554458f05dcbb5c65b8c7a749b0; // keccak256(abi.encodePacked("deployedAtBlock"))

    function deployedAtBlock() external view returns (uint256) {
        return uintStorage[DEPLOYED_AT_BLOCK];
    }
}
