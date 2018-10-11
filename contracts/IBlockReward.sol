pragma solidity 0.4.24;


interface IBlockReward {
    function addExtraReceiver(uint256 _amount, address _receiver) external;
    function mintedTotally() public view returns (uint256);
    function mintedTotallyByBridge(address _bridge) public view returns(uint256);
    function bridgesAllowed() public pure returns(address[3]);
}
