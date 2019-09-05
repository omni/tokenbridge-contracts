pragma solidity 0.4.24;

interface IAMB {
    function messageSender() external view returns (address);
    function transactionHash() external view returns (bytes32);
    function withdrawFromDeposit(address _recipient) external;
    function requireToPassMessage(address _contract, bytes _data, uint256 _gas) public;
}
