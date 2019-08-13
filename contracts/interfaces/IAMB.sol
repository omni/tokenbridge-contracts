pragma solidity 0.4.24;

interface IAMB {
    function messageSender() external view returns (address);
    function maxGasPerTx() external view returns (uint256);
    function withdrawFromDeposit(address _recipient) external;
    function requireToPassMessage(address _contract, bytes _data, uint256 _gas) external;
    function requireToPassMessage(address _contract, bytes _data, uint256 _gas, uint256 _gasPrice) external;
    function requireToPassMessage(address _contract, bytes _data, uint256 _gas, bytes1 _oracleGasPriceSpeed) external;
}
