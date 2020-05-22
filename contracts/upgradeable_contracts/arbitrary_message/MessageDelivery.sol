pragma solidity 0.4.24;

import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "./BasicAMB.sol";
import "../../libraries/ArbitraryMessage.sol";
import "../../libraries/Bytes.sol";

contract MessageDelivery is BasicAMB {
    using SafeMath for uint256;

    /**
    * @dev Requests message relay to the opposite network
    * @param _contract executor address on the other side
    * @param _data calldata passed to the executor on the other side
    * @param _gas gas limit used on the other network for executing a message
    */
    function requireToPassMessage(address _contract, bytes _data, uint256 _gas) public returns (bytes32) {
        require(_gas >= getMinimumGasUsage(_data) && _gas <= maxGasPerTx());

        bytes memory sourceChainId = _sourceChainId();
        bytes memory destinationChainId = _destinationChainId();

        // 4 bytes - message version
        // 20 bytes - bridge id
        // 8 bytes - message nonce
        bytes32 messageId = MESSAGE_PACKING_VERSION |
            (keccak256(abi.encodePacked(sourceChainId, address(this))) &
                0x00000000ffffffffffffffffffffffffffffffffffffffff0000000000000000) |
            bytes32(_nonce());
        _setNonce(_nonce() + 1);
        bytes memory eventData = abi.encodePacked(
            messageId,
            msg.sender,
            _contract,
            uint32(_gas),
            uint8(sourceChainId.length),
            uint8(destinationChainId.length),
            uint8(0x00),
            sourceChainId,
            destinationChainId,
            _data
        );

        emitEventOnMessageRequest(messageId, eventData);
        return messageId;
    }

    function getMinimumGasUsage(bytes _data) public pure returns (uint256 gas) {
        // From Ethereum Yellow Paper
        // 68 gas is paid for every non-zero byte of data or code for a transaction
        // Starting from Istanbul hardfork, 16 gas is paid (EIP-2028)
        return _data.length.mul(16);
    }

    /* solcov ignore next */
    function emitEventOnMessageRequest(bytes32 messageId, bytes encodedData) internal;
}
