pragma solidity 0.4.24;

library Bytes {
    function bytesToBytes32(bytes _bytes) internal pure returns (bytes32 result) {
        assembly {
            result := mload(add(_bytes, 32))
        }
    }
}
