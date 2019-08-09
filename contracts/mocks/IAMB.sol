pragma solidity 0.4.24;

interface IAMB {
    function messageSender() external view returns (address);
    function withdrawFromDeposit(address) external;
}
