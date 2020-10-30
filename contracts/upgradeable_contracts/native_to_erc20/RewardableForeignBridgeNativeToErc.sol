pragma solidity 0.4.24;

import "../RewardableBridge.sol";

contract RewardableForeignBridgeNativeToErc is RewardableBridge {
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

    function getHomeFee() public view returns (uint256) {
        return _getFee(HOME_FEE);
    }

    /**
     * @dev Internal function for distributing the fee for collecting sufficient amount of signatures.
     * @param _fee amount of fee to distribute.
     * @param _feeManager address of the fee manager contract.
     * @param _txHash reference transaction hash where the original bridge request happened.
     */
    function distributeFeeFromSignatures(uint256 _fee, address _feeManager, bytes32 _txHash) internal {
        require(_feeManager.delegatecall(abi.encodeWithSelector(DISTRIBUTE_FEE_FROM_SIGNATURES, _fee)));
        emit FeeDistributedFromSignatures(_fee, _txHash);
    }
}
