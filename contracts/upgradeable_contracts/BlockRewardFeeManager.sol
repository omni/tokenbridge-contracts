pragma solidity 0.4.24;

import "./BaseFeeManager.sol";
import "../interfaces/IBlockReward.sol";

contract BlockRewardFeeManager is BaseFeeManager {
    function distributeFeeFromAffirmation(uint256 _fee) external {
        distributeFeeFromBlockReward(_fee);
    }

    function distributeFeeFromSignatures(uint256 _fee) external {
        distributeFeeFromBlockReward(_fee);
    }

    function _blockRewardContract() internal view returns (IBlockReward) {
        return IBlockReward(addressStorage[keccak256(abi.encodePacked("blockRewardContract"))]);
    }

    /* solcov ignore next */
    function distributeFeeFromBlockReward(uint256 _fee) internal;
}
