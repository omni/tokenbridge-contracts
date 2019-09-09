pragma solidity 0.4.24;

interface IAMB {
    function messageSender() external view returns (address);
    function maxGasPerTx() external view returns (uint256);
    function transactionHash() external view returns (bytes32);
    function messageCallStatus(bytes32 _txHash) external view returns (address);
    function messageDataHash(bytes32 _txHash) external view returns (bytes32);
    function requireToPassMessage(address _contract, bytes _data, uint256 _gas) external;
}
