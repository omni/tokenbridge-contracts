pragma solidity 0.4.24;

contract ReentrancyGuard {
    function lock() internal returns (bool res) {
        assembly {
            // keccak256(abi.encodePacked("lock"))
            res := sload(0x6168652c307c1e813ca11cfb3a601f1cf3b22452021a5052d8b05f1f1f8a3e92)
        }
    }

    function setLock(bool _lock) internal {
        assembly {
            // keccak256(abi.encodePacked("lock"))
            sstore(0x6168652c307c1e813ca11cfb3a601f1cf3b22452021a5052d8b05f1f1f8a3e92, _lock)
        }
    }
}
