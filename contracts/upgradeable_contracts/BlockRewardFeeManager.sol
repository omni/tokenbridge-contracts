pragma solidity 0.4.24;

import "./BaseFeeManager.sol";
import "./BlockRewardBridge.sol";

contract BlockRewardFeeManager is BaseFeeManager, BlockRewardBridge {
    function distributeFeeFromAffirmation(uint256 _fee) external {
        distributeFeeFromBlockReward(_fee);
    }

    function distributeFeeFromSignatures(uint256 _fee) external {
        distributeFeeFromBlockReward(_fee);
    }

    /* solcov ignore next */
    function distributeFeeFromBlockReward(uint256 _fee) internal;
}
