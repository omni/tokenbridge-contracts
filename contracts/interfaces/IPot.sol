pragma solidity 0.4.24;

interface IPot {
    function chi() external view returns (uint256);
    function rho() external view returns (uint256);
    function drip() external returns (uint256);
}
