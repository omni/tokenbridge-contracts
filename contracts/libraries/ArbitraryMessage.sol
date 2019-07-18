pragma solidity 0.4.24;

import "../interfaces/IBridgeValidators.sol";


library ArbitraryMessage {
    function recoverAddressFromSignedMessage(bytes signature, bytes message) internal pure returns (address) {
        require(signature.length == 65);
        bytes32 r;
        bytes32 s;
        bytes1 v;

        assembly {
            r := mload(add(signature, 0x20))
            s := mload(add(signature, 0x40))
            v := mload(add(signature, 0x60))
        }
        return ecrecover(hashMessage(message), uint8(v), r, s);
    }

    function hashMessage(bytes message) internal pure returns (bytes32) {
        bytes memory prefix = "\x19Ethereum Signed Message:\n";
        return keccak256(abi.encodePacked(prefix, uintToString(message.length), message));
    }

    function uintToString(uint i) internal pure returns (string) {
        if (i == 0) return "0";
        uint j = i;
        uint length;
        while (j != 0){
            length++;
            j /= 10;
        }
        bytes memory bstr = new bytes(length);
        uint k = length - 1;
        while (i != 0){
            bstr[k--] = byte(48 + i % 10);
            i /= 10;
        }
        return string(bstr);
    }

    function hasEnoughValidSignatures(
        bytes _message,
        uint8[] _vs,
        bytes32[] _rs,
        bytes32[] _ss,
        IBridgeValidators _validatorContract) internal view {
        uint256 requiredSignatures = _validatorContract.requiredSignatures();
        require(_vs.length >= requiredSignatures);
        bytes32 hash = hashMessage(_message);
        address[] memory encounteredAddresses = new address[](requiredSignatures);
        for (uint256 i = 0; i < requiredSignatures; i++) {
            address recoveredAddress = ecrecover(hash, _vs[i], _rs[i], _ss[i]);
            require(_validatorContract.isValidator(recoveredAddress));
            if (addressArrayContains(encounteredAddresses, recoveredAddress)) {
                revert();
            }
            encounteredAddresses[i] = recoveredAddress;
        }
    }

    function addressArrayContains(address[] array, address value) internal pure returns (bool) {
        for (uint256 i = 0; i < array.length; i++) {
            if (array[i] == value) {
                return true;
            }
        }
        return false;
    }

    // layout of message :: bytes:
    // offset  0: 32 bytes :: uint256 - message length
    // offset 32: 20 bytes :: address - sender address
    // offset 52: 20 bytes :: address - executor contract
    // offset 72: 32 bytes :: bytes32 txHash
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
    returns(
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
        // 20 (sender)  + 20 (executor) + 32 (tx hash) + 32 (gasLimit) + 1 (dataType)
        uint256 srcdataptr = 20 + 20 + 32 + 32 + 1 ;
        assembly {
            sender := and(mload(add(_data, 20)), 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF)
            executor := and(mload(add(_data, 40)), 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF)
            txHash := mload(add(_data, 72))
            gasLimit := mload(add(_data, 104))
            dataType := and(mload(add(_data, 136)), 0xFF00000000000000000000000000000000000000000000000000000000000000)
            switch dataType
            case 0x0000000000000000000000000000000000000000000000000000000000000000 {
                gasPrice := 0
                if eq(applyDataOffset, 1) { dataOffset := sub(srcdataptr, 9) }
            }
            case 0x0100000000000000000000000000000000000000000000000000000000000000 {
                gasPrice := mload(add(_data, 137)) // 32
                srcdataptr := add(srcdataptr, 0x20)
                if eq(applyDataOffset, 1) { dataOffset := sub(srcdataptr, 41) }
            }
            case 0x0200000000000000000000000000000000000000000000000000000000000000 {
                gasPrice := 0
                srcdataptr := add(srcdataptr, 0x01)
                if eq(applyDataOffset, 1) { dataOffset := sub(srcdataptr, 10) }
            }
            datasize := sub(mload(_data), srcdataptr)
        }
        data = new bytes(datasize);
        assembly {
            // BYTES_HEADER_SIZE
            let dataptr := add(data, 32)
            // 68 = 4 (selector) + 32 (bytes header) + 32 (bytes length)
            calldatacopy(dataptr, add(add(68, srcdataptr), dataOffset), datasize)
        }
    }
}
