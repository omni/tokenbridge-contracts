pragma solidity 0.4.24;

import "../../interfaces/IBlockReward.sol";
import "../BlockRewardFeeManager.sol";

contract FeeManagerErcToNativePOSDAO is BlockRewardFeeManager {
    function getFeeManagerMode() external pure returns (bytes4) {
        return 0xd7de965f; // bytes4(keccak256(abi.encodePacked("manages-both-directions")))
    }

    function distributeFeeFromBlockReward(uint256 _fee) internal {
        IBlockReward blockReward = _blockRewardContract();
        blockReward.addBridgeNativeRewardReceivers(_fee);
    }

    function getAmountToBurn(uint256 _value) public view returns (uint256) {
        return _value;
    }
}
