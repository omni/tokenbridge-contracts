pragma solidity 0.4.24;

import "../BaseFeeManager.sol";
import "../../IBlockReward.sol";

contract FeeManagerErcToNative is BaseFeeManager {

    function blockRewardContract() internal view returns(IBlockReward) {
        return IBlockReward(addressStorage[keccak256(abi.encodePacked("blockRewardContract"))]);
    }

    function onAffirmationFeeDistribution(address _rewardAddress, uint256 _fee) internal {
        IBlockReward blockReward = blockRewardContract();
        blockReward.addExtraReceiver(_fee, _rewardAddress);
    }

    function onSignatureFeeDistribution(address _rewardAddress, uint256 _fee) internal {
        _rewardAddress.send(_fee);
    }
}
