pragma solidity 0.4.24;

import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "./BasicAMB.sol";

contract MessageDelivery is BasicAMB {
    using SafeMath for uint256;

    function requireToPassMessage(address _contract, bytes _data, uint256 _gas) public returns (bytes32 messageId) {
        require(_gas >= getMinimumGasUsage(_data) && _gas <= maxGasPerTx());
        messageId = nonce();
        bytes memory eventData = abi.encodePacked(messageId, msg.sender, _contract, _gas, uint8(0x00), _data);
        _setNonce(keccak256(eventData));
        emitEventOnMessageRequest(messageId, eventData);
    }

    function getMinimumGasUsage(bytes _data) public pure returns (uint256 gas) {
        //From Ethereum Yellow Paper
        // 68 gas is paid for every non-zero byte of data or code for a transaction
        // Starting from Istanbul hardfork, 16 gas is paid (EIP-2028)
        return _data.length.mul(16);
    }

    /* solcov ignore next */
    function emitEventOnMessageRequest(bytes32 messageId, bytes encodedData) internal;
}
