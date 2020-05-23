pragma solidity 0.4.24;

library ArbitraryMessage {
    /**
    * @dev Unpacks data fields from AMB message
    * layout of message :: bytes:
    * offset  0              : 32 bytes :: uint256 - message length
    * offset 32              : 32 bytes :: bytes32 - messageId
    * offset 64              : 20 bytes :: address - sender address
    * offset 84              : 20 bytes :: address - executor contract
    * offset 104             : 4 bytes  :: uint32  - gasLimit
    * offset 108             : 1 bytes  :: uint8   - source chain id length (X)
    * offset 109             : 1 bytes  :: uint8   - destination chain id length (Y)
    * offset 110             : 1 bytes  :: bytes1  - dataType
    * (optional) 111         : 32 bytes :: uint256 - gasPrice
    * (optional) 111         : 1 bytes  :: bytes1  - gasPriceSpeed
    * offset 111/143/112     : X bytes  :: bytes   - source chain id
    * offset 111/143/112 + X : Y bytes  :: bytes   - destination chain id

    * bytes 1 to 32 are 0 because message length is stored as little endian.
    * mload always reads 32 bytes.
    * so we can and have to start reading recipient at offset 20 instead of 32.
    * if we were to read at 32 the address would contain part of value and be corrupted.
    * when reading from offset 20 mload will read 12 zero bytes followed
    * by the 20 recipient address bytes and correctly convert it into an address.
    * this saves some storage/gas over the alternative solution
    * which is padding address to 32 bytes and reading recipient at offset 32.
    * for more details see discussion in:
    * https://github.com/paritytech/parity-bridge/issues/61

    * NOTE: when message structure is changed, make sure that MESSAGE_PACKING_VERSION from VersionableAMB is updated as well
    * NOTE: assembly code uses calldatacopy, make sure that message is passed as the first argument in the calldata
    * @param _data encoded message
    */
    function unpackData(bytes _data)
        internal
        pure
        returns (
            bytes32 messageId,
            address sender,
            address executor,
            uint32 gasLimit,
            bytes1 dataType,
            uint256[2] chainIds,
            uint256 gasPrice,
            bytes memory data
        )
    {
        // 32 (message id) + 20 (sender) + 20 (executor) + 4 (gasLimit) + 1 (source chain id length) + 1 (destination chain id length) + 1 (dataType)
        uint256 srcdataptr = 32 + 20 + 20 + 4 + 1 + 1 + 1;
        uint256 datasize;

        assembly {
            messageId := mload(add(_data, 32))
            sender := mload(add(_data, 52))
            executor := mload(add(_data, 72))
            gasLimit := mload(add(_data, 76))

            let srcChainIdLength := and(mload(add(_data, 77)), 0xff)
            let dstChainIdLength := and(mload(add(_data, 78)), 0xff)

            dataType := and(mload(add(_data, 110)), 0xFF00000000000000000000000000000000000000000000000000000000000000)
            switch dataType
                case 0x0000000000000000000000000000000000000000000000000000000000000000 {
                    gasPrice := 0
                }
                case 0x0100000000000000000000000000000000000000000000000000000000000000 {
                    gasPrice := mload(add(_data, 111)) // 32
                    srcdataptr := add(srcdataptr, 0x20)
                }
                case 0x0200000000000000000000000000000000000000000000000000000000000000 {
                    gasPrice := 0
                    srcdataptr := add(srcdataptr, 0x01)
                }

            // at this moment srcdataptr points to sourceChainId

            // mask for sourceChainId
            // e.g. length X -> (1 << (X * 8)) - 1
            let mask := sub(shl(shl(3, srcChainIdLength), 1), 1)

            // increase payload offset by length of source chain id
            srcdataptr := add(srcdataptr, srcChainIdLength)

            // write sourceChainId
            mstore(chainIds, and(mload(add(_data, srcdataptr)), mask))

            // at this moment srcdataptr points to destinationChainId

            // mask for destinationChainId
            // e.g. length X -> (1 << (X * 8)) - 1
            mask := sub(shl(shl(3, dstChainIdLength), 1), 1)

            // increase payload offset by length of destination chain id
            srcdataptr := add(srcdataptr, dstChainIdLength)

            // write destinationChainId
            mstore(add(chainIds, 32), and(mload(add(_data, srcdataptr)), mask))

            // at this moment srcdataptr points to payload

            // datasize = message length - payload offset
            datasize := sub(mload(_data), srcdataptr)
        }

        data = new bytes(datasize);
        assembly {
            // 36 = 4 (selector) + 32 (bytes length)
            srcdataptr := add(srcdataptr, 36)

            // calldataload(4) - offset of first bytes argument in the calldata
            calldatacopy(add(data, 32), add(calldataload(4), srcdataptr), datasize)
        }
    }
}
