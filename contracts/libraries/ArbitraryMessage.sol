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

    * NOTE: when message structure is changed, make sure that MESSAGE_PACKING_VERSION from VersionableAMB is updated as well
    * @param _data encoded message
    */
    function unpackHeader(bytes _data)
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
            uint256 offset
        )
    {
        // 32 (message id) + 20 (sender) + 20 (executor) + 4 (gasLimit) + 1 (source chain id length) + 1 (destination chain id length) + 1 (dataType)
        offset = 32 + 20 + 20 + 4 + 1 + 1 + 1;

        assembly {
            messageId := mload(add(_data, 32)) // 32 bytes
            sender := and(mload(add(_data, 52)), 0xffffffffffffffffffffffffffffffffffffffff) // 20 bytes

            // executor (20 bytes) + gasLimit (4 bytes) + srcChainIdLength (1 byte) + dstChainIdLength (1 bytes) + dataType (1 byte) + remainder (5 bytes)
            let blob := mload(add(_data, 84))

            // after bit shift left 12 bytes are zeros automatically
            executor := shr(96, blob)
            gasLimit := and(shr(64, blob), 0xffffffff)

            // load source chain id length
            let chainIdLength := byte(24, blob)

            dataType := and(shl(208, blob), 0xFF00000000000000000000000000000000000000000000000000000000000000)
            switch dataType
                case 0x0000000000000000000000000000000000000000000000000000000000000000 {
                    gasPrice := 0
                }
                case 0x0100000000000000000000000000000000000000000000000000000000000000 {
                    gasPrice := mload(add(_data, 111)) // 32
                    offset := add(offset, 32)
                }
                case 0x0200000000000000000000000000000000000000000000000000000000000000 {
                    gasPrice := 0
                    offset := add(offset, 1)
                }

            // at this moment offset points to sourceChainId

            // mask for sourceChainId
            // e.g. length X -> (1 << (X * 8)) - 1
            let mask := sub(shl(shl(3, chainIdLength), 1), 1)

            // increase payload offset by length of source chain id
            offset := add(offset, chainIdLength)

            // write sourceChainId
            mstore(chainIds, and(mload(add(_data, offset)), mask))

            // at this moment offset points to destinationChainId

            // load destination chain id length
            chainIdLength := byte(25, blob)

            // mask for destinationChainId
            // e.g. length X -> (1 << (X * 8)) - 1
            mask := sub(shl(shl(3, chainIdLength), 1), 1)

            // increase payload offset by length of destination chain id
            offset := add(offset, chainIdLength)

            // write destinationChainId
            mstore(add(chainIds, 32), and(mload(add(_data, offset)), mask))

            // at this moment offset points to payload

        }
    }

    /**
    * @dev Unpacks the payload field from the AMB message
    * NOTE: function modifies the given memory bytes object, it is unsafe to reuse it further
    * @param data encoded message
    * @param offset length of the message header
    * @return payload of the AMB message
    */
    function unpackPayload(bytes memory data, uint256 offset) internal pure returns (bytes memory payload) {
        assembly {
            // set a payload pointer
            payload := add(offset, data)
            mstore(payload, sub(mload(data), offset))
        }
    }
}
