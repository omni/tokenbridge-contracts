pragma solidity 0.4.24;

import "../BaseFeeManager.sol";
import "../../IBlockReward.sol";

contract FeeManagerErcToNativePOSDAO is BaseFeeManager {

    function getFeeManagerMode() public pure returns(bytes4) {
        return bytes4(keccak256(abi.encodePacked("manages-both-directions")));
    }

    function blockRewardContract() internal view returns(IBlockReward) {
        return IBlockReward(addressStorage[keccak256(abi.encodePacked("blockRewardContract"))]);
    }

    function distributeFeeFromAffirmation(uint256 _fee) external {
        distributeFeeFromBlockReward(_fee);
    }

    function distributeFeeFromSignatures(uint256 _fee) external {
        distributeFeeFromBlockReward(_fee);
    }

    function distributeFeeFromBlockReward(uint256 _fee) internal {
        IBlockReward blockReward = blockRewardContract();
        blockReward.addBridgeNativeFeeReceivers(_fee);
    }

    function getAmountToBurn(uint256 _value) public view returns(uint256) {
        return _value;
    }

    function onAffirmationFeeDistribution(address _rewardAddress, uint256 _fee) internal {}

    function onSignatureFeeDistribution(address _rewardAddress, uint256 _fee) internal {}
}
