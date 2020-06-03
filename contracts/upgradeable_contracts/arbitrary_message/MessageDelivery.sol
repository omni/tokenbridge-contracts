pragma solidity 0.4.24;

import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "./BasicAMB.sol";
import "./MessageProcessor.sol";
import "../../libraries/ArbitraryMessage.sol";
import "../../libraries/Bytes.sol";

contract MessageDelivery is BasicAMB, MessageProcessor {
    using SafeMath for uint256;

    /**
    * @dev Requests message relay to the opposite network
    * @param _contract executor address on the other side
    * @param _data calldata passed to the executor on the other side
    * @param _gas gas limit used on the other network for executing a message
    */
    function requireToPassMessage(address _contract, bytes _data, uint256 _gas) public returns (bytes32) {
        // it is not allowed to pass messages while other messages are processed
        require(messageId() == bytes32(0));

        require(_gas >= getMinimumGasUsage(_data) && _gas <= maxGasPerTx());

        bytes32 _messageId;
        bytes memory header = _packHeader(_contract, _gas);
        _setNonce(_nonce() + 1);

        assembly {
            _messageId := mload(add(header, 32))
        }

        bytes memory eventData = abi.encodePacked(header, _data);

        emitEventOnMessageRequest(_messageId, eventData);
        return _messageId;
    }

    /**
    * @dev Returns a lower limit on gas limit for the particular message data
    * @param _data calldata passed to the executor on the other side
    */
    function getMinimumGasUsage(bytes _data) public pure returns (uint256 gas) {
        // From Ethereum Yellow Paper
        // 68 gas is paid for every non-zero byte of data or code for a transaction
        // Starting from Istanbul hardfork, 16 gas is paid (EIP-2028)
        return _data.length.mul(16);
    }

    /**
    * @dev Packs message header into a single bytes blob
    * @param _contract executor address on the other side
    * @param _gas gas limit used on the other network for executing a message
    */
    function _packHeader(address _contract, uint256 _gas) internal view returns (bytes memory header) {
        uint256 sourceChainId = _sourceChainId();
        uint256 sourceChainIdLength = _sourceChainIdLength();
        uint256 destinationChainId = _destinationChainId();
        uint256 destinationChainIdLength = _destinationChainIdLength();

        bytes32 mVer = MESSAGE_PACKING_VERSION;
        uint256 nonce = _nonce();

        // Bridge id is recalculated every time again and again, since it is still cheaper than using SLOAD opcode (800 gas)
        bytes32 bridgeId = keccak256(abi.encodePacked(sourceChainId, address(this))) &
            0x00000000ffffffffffffffffffffffffffffffffffffffff0000000000000000;
        // 79 = 4 + 20 + 8 + 20 + 20 + 4 + 1 + 1 + 1
        header = new bytes(79 + sourceChainIdLength + destinationChainIdLength);

        // In order to save the gas, the header is packed in the reverse order.
        // With such approach, it is possible to store right-aligned values without any additional bit shifts.
        assembly {
            let ptr := add(header, mload(header)) // points to the last word of header
            mstore(ptr, destinationChainId)
            mstore(sub(ptr, destinationChainIdLength), sourceChainId)

            mstore(add(header, 79), 0x00)
            mstore(add(header, 78), destinationChainIdLength)
            mstore(add(header, 77), sourceChainIdLength)
            mstore(add(header, 76), _gas)
            mstore(add(header, 72), _contract)
            mstore(add(header, 52), caller)

            mstore(add(header, 32), or(mVer, or(bridgeId, nonce)))
        }
    }

    /* solcov ignore next */
    function emitEventOnMessageRequest(bytes32 messageId, bytes encodedData) internal;
}
