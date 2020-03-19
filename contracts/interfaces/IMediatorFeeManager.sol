pragma solidity 0.4.24;

interface IMediatorFeeManager {
    function calculateFee(uint256) external view returns (uint256);
}
