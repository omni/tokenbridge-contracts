pragma solidity 0.4.24;

import "../upgradeability/EternalStorage.sol";

contract Initializable is EternalStorage {
    bytes32 internal constant INITIALIZED = keccak256(abi.encodePacked("isInitialized"));
    bytes32 internal constant DEPLOYED_AT_BLOCK = keccak256(abi.encodePacked("deployedAtBlock"));

    function setInitialize() internal {
        boolStorage[INITIALIZED] = true;
    }

    function isInitialized() public view returns (bool) {
        return boolStorage[INITIALIZED];
    }

    function deployedAtBlock() external view returns (uint256) {
        return uintStorage[DEPLOYED_AT_BLOCK];
    }
}
