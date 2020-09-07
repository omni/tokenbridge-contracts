pragma solidity 0.4.24;

import "../BlockRewardFeeManager.sol";

contract FeeManagerErcToErcPOSDAO is BlockRewardFeeManager {
    function getFeeManagerMode() external pure returns (bytes4) {
        return 0xd7de965f; // bytes4(keccak256(abi.encodePacked("manages-both-directions")))
    }

    function blockRewardContract() external view returns (address) {
        return _blockRewardContract();
    }

    function setBlockRewardContract(address _blockReward) external {
        _setBlockRewardContract(_blockReward);
    }

    function distributeFeeFromBlockReward(uint256 _fee) internal {
        IBlockReward blockReward = _blockRewardContract();
        blockReward.addBridgeTokenRewardReceivers(_fee);
    }
}
