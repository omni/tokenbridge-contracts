pragma solidity 0.4.24;

import "../RewardableBridge.sol";

contract RewardableForeignBridgeNativeToErc is RewardableBridge {
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
