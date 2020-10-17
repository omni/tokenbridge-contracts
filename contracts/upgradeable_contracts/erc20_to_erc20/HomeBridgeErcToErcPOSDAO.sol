pragma solidity 0.4.24;

import "./HomeBridgeErcToErc.sol";

contract HomeBridgeErcToErcPOSDAO is HomeBridgeErcToErc {
    function rewardableInitialize(
        address _validatorContract,
        uint256[3] _dailyLimitMaxPerTxMinPerTxArray, // [ 0 = _dailyLimit, 1 = _maxPerTx, 2 = _minPerTx ]
        uint256 _homeGasPrice,
        uint256 _requiredBlockConfirmations,
        address _erc677token,
        uint256[2] _foreignDailyLimitForeignMaxPerTxArray, // [ 0 = _foreignDailyLimit, 1 = _foreignMaxPerTx ]
        address _owner,
        address _feeManager,
        uint256[2] _homeFeeForeignFeeArray, // [ 0 = _homeFee, 1 = _foreignFee ]
        address _blockReward,
        int256 _decimalShift
    ) external onlyRelevantSender returns (bool) {
        _rewardableInitialize(
            _validatorContract,
            _dailyLimitMaxPerTxMinPerTxArray,
            _homeGasPrice,
            _requiredBlockConfirmations,
            _erc677token,
            _foreignDailyLimitForeignMaxPerTxArray,
            _owner,
            _feeManager,
            _homeFeeForeignFeeArray,
            _decimalShift
        );
        _setBlockRewardContract(_feeManager, _blockReward);
        setInitialize();

        return isInitialized();
    }

    function blockRewardContract() public view returns (address) {
        bytes memory callData = abi.encodeWithSelector(this.blockRewardContract.selector);
        return address(_delegateReadToFeeManager(callData));
    }

    function setBlockRewardContract(address _blockReward) external onlyOwner {
        address feeManager = feeManagerContract();
        _setBlockRewardContract(feeManager, _blockReward);
    }

    function _setBlockRewardContract(address _feeManager, address _blockReward) internal {
        bytes memory callData = abi.encodeWithSelector(this.setBlockRewardContract.selector, _blockReward);
        require(_feeManager.delegatecall(callData));
    }
}
