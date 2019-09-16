pragma solidity 0.4.24;

import "../upgradeability/EternalStorage.sol";

contract ReentrancyGuard is EternalStorage {
    bytes32 internal constant LOCK = keccak256(abi.encodePacked("lock"));

    function lock() internal returns (bool) {
        return boolStorage[LOCK];
    }

    function setLock(bool _lock) internal {
        boolStorage[LOCK] = _lock;
    }
}
