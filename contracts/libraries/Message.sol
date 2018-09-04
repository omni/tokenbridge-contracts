pragma solidity 0.4.24;
import "../IBridgeValidators.sol";


library Message {
    // function uintToString(uint256 inputValue) internal pure returns (string) {
    //     // figure out the length of the resulting string
    //     uint256 length = 0;
    //     uint256 currentValue = inputValue;
    //     do {
    //         length++;
    //         currentValue /= 10;
    //     } while (currentValue != 0);
    //     // allocate enough memory
    //     bytes memory result = new bytes(length);
    //     // construct the string backwards
    //     uint256 i = length - 1;
    //     currentValue = inputValue;
    //     do {
    //         result[i--] = byte(48 + currentValue % 10);
    //         currentValue /= 10;
    //     } while (currentValue != 0);
    //     return string(result);
    // }

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
    // offset 32: 20 bytes :: address - recipient address
    // offset 52: 32 bytes :: uint256 - value
    // offset 84: 32 bytes :: bytes32 - transaction hash
    // offset 104: 20 bytes :: address - contract address to prevent double spending

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
    function parseMessage(bytes message)
        internal
        pure
        returns(address recipient, uint256 amount, bytes32 txHash, address contractAddress)
    {
        require(isMessageValid(message));
        assembly {
            recipient := and(mload(add(message, 20)), 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF)
            amount := mload(add(message, 52))
            txHash := mload(add(message, 84))
            contractAddress := mload(add(message, 104))
        }
    }

    function isMessageValid(bytes _msg) internal pure returns(bool) {
        return _msg.length == requiredMessageLength();
    }

    function requiredMessageLength() internal pure returns(uint256) {
        return 104;
    }

    function recoverAddressFromSignedMessage(bytes signature, bytes message) internal pure returns (address) {
        require(signature.length == 65);
        bytes32 r;
        bytes32 s;
        bytes1 v;
        // solium-disable-next-line security/no-inline-assembly
        assembly {
            r := mload(add(signature, 0x20))
            s := mload(add(signature, 0x40))
            v := mload(add(signature, 0x60))
        }
        return ecrecover(hashMessage(message), uint8(v), r, s);
    }

    function hashMessage(bytes message) internal pure returns (bytes32) {
        bytes memory prefix = "\x19Ethereum Signed Message:\n";
        // message is always 84 length
        string memory msgLength = "104";
        return keccak256(abi.encodePacked(prefix, msgLength, message));
    }

    function hasEnoughValidSignatures(
        bytes _message,
        uint8[] _vs,
        bytes32[] _rs,
        bytes32[] _ss,
        IBridgeValidators _validatorContract) internal view {
        require(isMessageValid(_message));
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

    function unpackData(bytes _data)
    internal
    pure
    returns(address sender, address executor, uint256 gasLimit, bytes1 dataType, uint256 gasPrice, bytes32 txHash, bytes memory data)
    {
        uint256 datasize;
        uint256 srcdataptr = 20 + 20 + 32 + 1 + 32; //20 (sender)  + 20 (executor) + 32 (gasLimit) + 1 (dataType) + 32 (tx hash)
        assembly {
            sender := and(mload(add(_data, 20)), 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF)
            executor := and(mload(add(_data, 40)), 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF)
            gasLimit := mload(add(_data, 72))
            dataType := and(mload(add(_data, 104)), 0xFF00000000000000000000000000000000000000000000000000000000000000)
            switch dataType
            case 0x0000000000000000000000000000000000000000000000000000000000000000 {
                gasPrice := 0
                //oracleGasPriceSpeed := 0x00
                txHash := mload(add(_data, 105))
            }
            case 0x0100000000000000000000000000000000000000000000000000000000000000 {
                gasPrice := mload(add(_data, 105)) // 32
                //oracleGasPriceSpeed := 0x00
                txHash := mload(add(_data, 137))
                srcdataptr := add(srcdataptr, 0x20)
            }
            case 0x0200000000000000000000000000000000000000000000000000000000000000 {
                gasPrice := 0
                //oracleGasPriceSpeed := and(mload(add(_data, 105)), 0xFF00000000000000000000000000000000000000000000000000000000000000) // 1
                txHash := mload(add(_data, 106))
                //srcdataptr := add(srcdataptr, 0x01)
            }
            default {
                revert(0, 1)
            }
            datasize := sub(mload(_data), srcdataptr)
        }
        data = new bytes(datasize);
        assembly {
            let dataptr := add(data, /*BYTES_HEADER_SIZE*/32)
            calldatacopy(dataptr, add(68, srcdataptr), datasize) //68 = 4 (selector) + 32 (bytes header) + 32 (bytes length)
        }
    }
}
