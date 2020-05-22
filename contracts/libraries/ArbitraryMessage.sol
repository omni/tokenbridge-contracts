pragma solidity 0.4.24;

import "../interfaces/IBridgeValidators.sol";
import "./Message.sol";

library ArbitraryMessage {
    /**
    * @dev Unpacks data fields from AMB message
    * layout of message :: bytes:
    * offset  0              : 32 bytes :: uint256 - message length
    * offset 32              : 32 bytes :: bytes32 - messageId
    * offset 64              : 20 bytes :: address - sender address
    * offset 84              : 20 bytes :: address - executor contract
    * offset 104             : 4 bytes  :: uint32  - gasLimit
    * offset 108             : 1 bytes  :: uint8   - source chain id length
    * offset 109             : 1 bytes  :: uint8   - destination chain id length
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
    * @param _data encoded message
    * @param applyDataOffset indicates if a calldata contains a second argument after message itself
    */
    function unpackData(bytes _data, bool applyDataOffset)
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

        // most significant byte - length of source chain id
        // least significant byte - length of destination chain id
        uint16 chainIdLengths;
        assembly {
            messageId := mload(add(_data, 32))
            sender := mload(add(_data, 52))
            executor := mload(add(_data, 72))
            gasLimit := mload(add(_data, 76))

            chainIdLengths := and(mload(add(_data, 78)), 0xffff)

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
            // e.g. 0x0a0b -> 0x0a00 -> 0x50 -> 0x0100..00 (11 bytes) -> 0xff..ff (10 bytes)
            let mask := sub(shl(shr(5, and(chainIdLengths, 0xff00)), 1), 1)

            srcdataptr := add(srcdataptr, shr(8, chainIdLengths))

            // write sourceChainId
            mstore(chainIds, and(mload(add(_data, srcdataptr)), mask))


            // at this moment srcdataptr points to destinationChainId


            // mask for destinationChainId
            // e.g. 0x0a0b -> 0x0b -> 0x58 -> 0x0100..00 (12 bytes) -> 0xff..ff (11 bytes)
            mask := sub(shl(shl(3, and(chainIdLengths, 0xff)), 1), 1)

            srcdataptr := add(srcdataptr, and(chainIdLengths, 0xff))

            // write destinationChainId
            mstore(add(chainIds, 32), and(mload(add(_data, srcdataptr)), mask))


            // at this moment srcdataptr points to payload

            datasize := sub(mload(_data), srcdataptr)
        }

        data = new bytes(datasize);
        assembly {
            switch applyDataOffset
            case 1 {
                // 100 = 4 (selector) + 32 (bytes header) + 32 (bytes header) + 32 (bytes length)
                srcdataptr := add(srcdataptr, 100)
            }
            default {
                // 68 = 4 (selector) + 32 (bytes header) + 32 (bytes length)
                srcdataptr := add(srcdataptr, 68)
            }

            calldatacopy(add(data, 32), srcdataptr, datasize)
        }
    }
}
