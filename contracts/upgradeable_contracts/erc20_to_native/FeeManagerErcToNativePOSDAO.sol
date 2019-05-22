pragma solidity 0.4.24;

import "../../IBlockReward.sol";
import "../BlockRewardFeeManager.sol";

contract FeeManagerErcToNativePOSDAO is BlockRewardFeeManager {

    function getFeeManagerMode() public pure returns(bytes4) {
        return bytes4(keccak256(abi.encodePacked("manages-both-directions")));
    }

    function distributeFeeFromBlockReward(uint256 _fee) internal {
        IBlockReward blockReward = _blockRewardContract();
        blockReward.addBridgeNativeFeeReceivers(_fee);
    }

    function getAmountToBurn(uint256 _value) public view returns(uint256) {
        return _value;
    }
}
