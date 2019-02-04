pragma solidity 0.4.24;

import "../RewardableBridge.sol";


contract RewardableHomeBridgeNativeToErc is RewardableBridge {

    function setForeignFee(uint256 _fee) external onlyOwner {
        _setFee(feeManagerContract(), _fee, FOREIGN_FEE);
    }

    function getForeignFee() public view returns(uint256) {
        return _getFee(FOREIGN_FEE);
    }
}
