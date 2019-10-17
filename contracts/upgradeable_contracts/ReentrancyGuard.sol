pragma solidity 0.4.24;

import "../upgradeability/EternalStorage.sol";

contract ReentrancyGuard is EternalStorage {
    bytes32 internal constant LOCK = 0x6168652c307c1e813ca11cfb3a601f1cf3b22452021a5052d8b05f1f1f8a3e92; // keccak256(abi.encodePacked("lock"))

    function lock() internal returns (bool) {
        return boolStorage[LOCK];
    }

    function setLock(bool _lock) internal {
        boolStorage[LOCK] = _lock;
    }
}
