pragma solidity 0.4.24;

import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "./BasicAMB.sol";
import "./VersionableAMB.sol";
import "../../libraries/Bytes.sol";

contract MessageDelivery is BasicAMB, VersionableAMB {
    using SafeMath for uint256;

    /**
    * @dev Requests message relay to the opposite network
    * @param _contract executor address on the other side
    * @param _data calldata passed to the executor on the other side
    * @param _gas gas limit used on the other network for executing a message
    */
    function requireToPassMessage(address _contract, bytes _data, uint256 _gas) public returns (bytes32) {
        require(_gas >= getMinimumGasUsage(_data) && _gas <= maxGasPerTx());

        uint256 chainId = _chainId();
        bytes20 bridgeId = bytes20(keccak256(abi.encodePacked(chainId, address(this))));
        uint64 nonce = _nonce();
        _setNonce(nonce + 1);

        bytes32 messageId = Bytes.bytesToBytes32(abi.encodePacked(ENCODED_BRIDGE_VERSION, bridgeId, nonce));
        bytes memory eventData = abi.encodePacked(
            messageId,
            chainId,
            msg.sender,
            _contract,
            uint32(_gas),
            uint8(0x00),
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
