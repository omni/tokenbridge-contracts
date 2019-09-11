pragma solidity 0.4.24;

interface IAMB {
    function messageSender() external view returns (address);
    function maxGasPerTx() external view returns (uint256);
    function transactionHash() external view returns (bytes32);
    function messageCallStatus(bytes32 _txHash) external view returns (bool);
    function failedMessageDataHash(bytes32 _txHash) external view returns (bytes32);
    function failedMessageReceiver(bytes32 _txHash) external view returns (address);
    function failedMessageSender(bytes32 _txHash) external view returns (address);
    function requireToPassMessage(address _contract, bytes _data, uint256 _gas) external;
}
