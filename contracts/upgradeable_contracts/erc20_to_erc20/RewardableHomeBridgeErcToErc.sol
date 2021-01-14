pragma solidity 0.4.24;

import "../RewardableBridge.sol";

contract RewardableHomeBridgeErcToErc is RewardableBridge {
    /**
     * @dev Updates the fee percentage for home->foreign bridge operations.
     * Only owner is allowed to call this method.
     * If during this operation, home fee is changed, it is highly recommended to stop the bridge operations first.
     * Otherwise, pending signature requests can become a reason for imbalance between two bridge sides.
     * @param _fee new value for fee percentage.
     */
    function setHomeFee(uint256 _fee) external onlyOwner {
        _setFee(feeManagerContract(), _fee, HOME_FEE);
    }

    /**
     * @dev Updates the fee percentage for foreign->home bridge operations.
     * Only owner is allowed to call this method.
     * @param _fee new value for fee percentage.
     */
    function setForeignFee(uint256 _fee) external onlyOwner {
        _setFee(feeManagerContract(), _fee, FOREIGN_FEE);
    }

    function getHomeFee() public view returns (uint256) {
        return _getFee(HOME_FEE);
    }

    function getForeignFee() public view returns (uint256) {
        return _getFee(FOREIGN_FEE);
    }
}
