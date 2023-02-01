interface ISourceAMB {
    function send(address receiver, uint16 chainId, uint256 gasLimit, bytes memory data) external returns (bytes32);
}

interface ITelepathyForeignApprover {
    function approvals(bytes32 messageId) external returns (bool);
}