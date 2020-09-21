pragma solidity 0.4.24;

import "./HomeAMB.sol";

contract OptimisticHomeAMB is HomeAMB {
    event UserRequestForOptimisticExecution(bytes32 indexed messageId, bytes encodedData);

    function requireToPassMessageOptimistically(address _contract, bytes _data, uint256 _gas)
        external
        returns (bytes32)
    {
        return requireToPassMessage(_contract, _data, _gas);
    }

    function emitEventOnMessageRequest(bytes32 messageId, bytes encodedData) internal {
        if (msg.sig == this.requireToPassMessage.selector) {
            emit UserRequestForSignature(messageId, encodedData);
        }
        emit UserRequestForOptimisticExecution(messageId, encodedData);
    }
}
