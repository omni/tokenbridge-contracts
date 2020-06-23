pragma solidity 0.4.24;

import "./IMediatorFeeManager.sol";

interface IMediatorFeeManagerBothDirections {
    function calculateFee(uint256) external view returns (uint256);
    function distributeFee(uint256) external;
    function calculateOppositeFee(uint256) external view returns (uint256);
    function distributeOppositeFee(uint256) external;
}
