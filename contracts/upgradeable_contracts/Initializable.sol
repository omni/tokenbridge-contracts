pragma solidity 0.4.24;

import "../upgradeability/EternalStorage.sol";

contract Initializable is EternalStorage {
    bytes32 internal constant INITIALIZED = keccak256(abi.encodePacked("isInitialized"));

    function setInitialize() internal {
        boolStorage[INITIALIZED] = true;
    }

    function isInitialized() public view returns (bool) {
        return boolStorage[INITIALIZED];
    }
}
