pragma solidity 0.4.24;

interface IGauge {
    function deposit(uint256 value) external;
    function withdraw(uint256 value) external;
    function totalSupply() external view returns (uint256);
    function balanceOf(address holder) external view returns (uint256);
}
