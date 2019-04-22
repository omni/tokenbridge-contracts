pragma solidity 0.4.24;

import "./BaseFeeManager.sol";
import "../IBlockReward.sol";

contract BlockRewardFeeManager is BaseFeeManager {

    function distributeFeeFromAffirmation(uint256 _fee) external {
        distributeFeeFromBlockReward(_fee);
    }

    function distributeFeeFromSignatures(uint256 _fee) external {
        distributeFeeFromBlockReward(_fee);
    }

    function distributeFeeFromBlockReward(uint256 _fee) internal {
        IBlockReward blockReward = _blockRewardContract();
        blockReward.addBridgeTokenFeeReceivers(_fee);
    }

    function _blockRewardContract() internal view returns(IBlockReward) {
        return IBlockReward(addressStorage[keccak256(abi.encodePacked("blockRewardContract"))]);
    }
}
