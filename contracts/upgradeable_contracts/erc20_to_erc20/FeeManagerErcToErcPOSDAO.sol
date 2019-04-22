pragma solidity 0.4.24;

import "../BlockRewardFeeManager.sol";

contract FeeManagerErcToErcPOSDAO is BlockRewardFeeManager {

    function getFeeManagerMode() public pure returns(bytes4) {
        return bytes4(keccak256(abi.encodePacked("manages-both-directions")));
    }

    function blockRewardContract() public view returns(address) {
        return _blockRewardContract();
    }

    function setBlockRewardContract(address _blockReward) external {
        require(_blockReward != address(0) && isContract(_blockReward) && (IBlockReward(_blockReward).bridgesAllowedLength() != 0));
        addressStorage[keccak256(abi.encodePacked("blockRewardContract"))] = _blockReward;
    }

    function distributeFeeFromBlockReward(uint256 _fee) internal {
        IBlockReward blockReward = _blockRewardContract();
        blockReward.addBridgeTokenFeeReceivers(_fee);
    }

    function isContract(address _addr) internal view returns (bool)
    {
        uint length;
        assembly { length := extcodesize(_addr) }
        return length > 0;
    }
}
