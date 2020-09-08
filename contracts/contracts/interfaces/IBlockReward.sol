pragma solidity 0.4.24;

interface IBlockReward {
    function addExtraReceiver(uint256 _amount, address _receiver) external;

    function mintedTotally() external view returns (uint256);

    function mintedTotallyByBridge(address _bridge) external view returns (uint256);

    function bridgesAllowedLength() external view returns (uint256);

    function addBridgeTokenRewardReceivers(uint256 _amount) external;

    function addBridgeNativeRewardReceivers(uint256 _amount) external;

    function blockRewardContractId() external pure returns (bytes4);
}
