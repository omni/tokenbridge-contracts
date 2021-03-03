pragma solidity 0.4.24;

interface IHomeErc20ToNativeBridge {
    function numMessagesSigned(bytes32 _message) external view returns (uint256);
    function isAlreadyProcessed(uint256 _number) external pure returns (bool);
    function message(bytes32 _hash) external view returns (bytes memory);
    function signature(bytes32 _hash, uint256 _index) external view returns (bytes memory);
}

contract Helper {
    function unpackSignature(bytes memory _signature) internal pure returns (bytes32 r, bytes32 s, uint8 v) {
        require(_signature.length == 65);

        assembly {
            r := mload(add(_signature, 0x20))
            s := mload(add(_signature, 0x40))
            v := mload(add(_signature, 0x41))
        }
        return (r, s, v);
    }
}

contract Erc20ToNativeBridgeHelper is Helper {
    address public owner;
    IHomeErc20ToNativeBridge public bridge;
    address public foreignBridge;

    constructor(address _homeBridge, address _foreignBridge) public {
        owner = msg.sender;
        bridge = IHomeErc20ToNativeBridge(_homeBridge);
        foreignBridge = _foreignBridge;
    }

    function getMessage(bytes32 _msgHash) external view returns (bytes memory result) {
        result = bridge.message(_msgHash);
    }

    function getMessageHash(address _recipient, uint256 _value, bytes32 _origTxHash) external view returns (bytes32) {
        bytes32 result = keccak256(abi.encodePacked(_recipient, _value, _origTxHash, foreignBridge));
        return result;
    }

    function getSignatures(bytes32 _msgHash) external view returns (bytes memory) {
        uint256 signed = bridge.numMessagesSigned(_msgHash);

        require(bridge.isAlreadyProcessed(signed), "message hasn't been confirmed");

        // recover number of confirmations sent by oracles
        signed = signed & 0x8fffffffffffffffffffffffffffffffffffffffffff;

        require(signed < 0x100);

        bytes memory signatures = new bytes(1 + signed * 65);

        assembly {
            mstore8(add(signatures, 32), signed)
        }

        for (uint256 i = 0; i < signed; i++) {
            bytes memory sig = bridge.signature(_msgHash, i);
            (bytes32 r, bytes32 s, uint8 v) = unpackSignature(sig);
            assembly {
                let ptr := add(signatures, 33)
                mstore8(add(ptr, i), v)
                ptr := add(ptr, signed)
                mstore(add(ptr, mul(i, 32)), r)
                ptr := add(ptr, mul(signed, 32))
                mstore(add(ptr, mul(i, 32)), s)
            }
        }

        return signatures;
    }

    function clean() external {
        require(msg.sender == owner, "not an owner");
        selfdestruct(owner);
    }
}
