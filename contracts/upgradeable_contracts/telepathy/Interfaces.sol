interface ISourceAMB {
    function send(address receiver, uint16 chainId, uint256 gasLimit, bytes data) external returns (bytes32);
}

interface ITelepathyForeignApprover {
    function isApproved(bytes32 messageId) external returns (bool);
}

interface IHomeOmnibridgeAMB {
    function executeAffirmation(bytes message) external;
}