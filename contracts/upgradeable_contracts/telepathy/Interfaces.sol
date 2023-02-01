interface ISourceAMB {
    function send(address receiver, uint16 chainId, uint256 gasLimit, bytes data) external returns (bytes32);
}