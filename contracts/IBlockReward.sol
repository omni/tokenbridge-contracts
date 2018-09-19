pragma solidity 0.4.24;


interface IBlockReward {
    function addExtraReceiver(uint256 _amount, address _receiver) external;
}
