pragma solidity 0.4.24;

import "../interfaces/IBridgeValidators.sol";
import "./Message.sol";

library ArbitraryMessage {
    // layout of message :: bytes:
    // offset  0: 32 bytes :: uint256 - message length
    // offset 32: 32 bytes :: bytes32 txHash
    // offset 52: 20 bytes :: address - sender address
    // offset 72: 20 bytes :: address - executor contract
    // offset 104: 32 bytes :: uint256 - gasLimit
    // offset 136: 1 bytes :: bytes1 - dataType
    // (optional) 137: 32 bytes :: uint256 - gasPrice
    // (optional) 137: 1 bytes :: bytes1 - gasPriceSpeed

    // bytes 1 to 32 are 0 because message length is stored as little endian.
    // mload always reads 32 bytes.
    // so we can and have to start reading recipient at offset 20 instead of 32.
    // if we were to read at 32 the address would contain part of value and be corrupted.
    // when reading from offset 20 mload will read 12 zero bytes followed
    // by the 20 recipient address bytes and correctly convert it into an address.
    // this saves some storage/gas over the alternative solution
    // which is padding address to 32 bytes and reading recipient at offset 32.
    // for more details see discussion in:
    // https://github.com/paritytech/parity-bridge/issues/61

    function unpackData(bytes _data, bool applyDataOffset)
        internal
        pure
        returns (
            address sender,
            address executor,
            bytes32 txHash,
            uint256 gasLimit,
            bytes1 dataType,
            uint256 gasPrice,
            bytes memory data
        )
    {
        uint256 dataOffset = 0;
        uint256 datasize;
        // 32 (tx hash) + 20 (sender)  + 20 (executor) + 32 (gasLimit) + 1 (dataType)
        uint256 srcdataptr = 32 + 20 + 20 + 32 + 1;
        assembly {
            txHash := mload(add(_data, 32))
            sender := mload(add(_data, 52))
            executor := mload(add(_data, 72))
            gasLimit := mload(add(_data, 104))
            dataType := and(mload(add(_data, 136)), 0xFF00000000000000000000000000000000000000000000000000000000000000)
            switch dataType
                case 0x0000000000000000000000000000000000000000000000000000000000000000 {
                    gasPrice := 0
                }
                case 0x0100000000000000000000000000000000000000000000000000000000000000 {
                    gasPrice := mload(add(_data, 137)) // 32
                    srcdataptr := add(srcdataptr, 0x20)
                }
                case 0x0200000000000000000000000000000000000000000000000000000000000000 {
                    gasPrice := 0
                    srcdataptr := add(srcdataptr, 0x01)
                }
            datasize := sub(mload(_data), srcdataptr)
        }
        data = new bytes(datasize);
        assembly {
            // BYTES_HEADER_SIZE
            let dataptr := add(data, 32)
            if eq(applyDataOffset, 1) {
                dataOffset := 32
            }
            // 68 = 4 (selector) + 32 (bytes header) + 32 (bytes length)
            calldatacopy(dataptr, add(add(68, srcdataptr), dataOffset), datasize)
        }
    }
}
