pragma solidity 0.4.24;

import "../RewardableBridge.sol";

contract RewardableForeignBridgeNativeToErc is RewardableBridge {
    function setHomeFee(uint256) external onlyOwner {
        _delegateWriteToFeeManager(msg.data);
    }

    function getHomeFee() external view returns (uint256) {
        return _delegateReadToFeeManager(msg.data);
    }
}
