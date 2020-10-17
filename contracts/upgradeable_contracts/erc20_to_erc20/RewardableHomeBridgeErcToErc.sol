pragma solidity 0.4.24;

import "../RewardableBridge.sol";

contract RewardableHomeBridgeErcToErc is RewardableBridge {
    function setHomeFee(uint256) external onlyOwner {
        _delegateWriteToFeeManager(msg.data);
    }

    function setForeignFee(uint256) external onlyOwner {
        _delegateWriteToFeeManager(msg.data);
    }

    function getHomeFee() external view returns (uint256) {
        return _delegateReadToFeeManager(msg.data);
    }

    function getForeignFee() external view returns (uint256) {
        return _delegateReadToFeeManager(msg.data);
    }
}
