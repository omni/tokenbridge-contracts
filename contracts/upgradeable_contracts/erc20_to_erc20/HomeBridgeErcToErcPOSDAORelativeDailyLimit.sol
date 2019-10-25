pragma solidity 0.4.24;

import "./HomeBridgeErcToErcPOSDAO.sol";
import "./HomeBridgeErcToErcRelativeDailyLimit.sol";

// solhint-disable-next-line no-empty-blocks
contract HomeBridgeErcToErcPOSDAORelativeDailyLimit is HomeBridgeErcToErcRelativeDailyLimit, HomeBridgeErcToErcPOSDAO {
    function rewardableInitialize(
        address _validatorContract,
        uint256[] _targetLimitThresholdMaxPerTxMinPerTxArray, // [ 0 = _targetLimit, 1 = _threshold, 2 = _maxPerTx, 3 = _minPerTx ]
        uint256 _homeGasPrice,
        uint256 _requiredBlockConfirmations,
        address _erc677token,
        uint256[] _foreignDailyLimitForeignMaxPerTxForeignMinPerTxArray, // [ 0 = _foreignDailyLimit, 1 = _foreignMaxPerTx, 2 = _foreignMinPerTx ]
        address _owner,
        address _feeManager,
        uint256[] _homeFeeForeignFeeArray, // [ 0 = _homeFee, 1 = _foreignFee ]
        address _blockReward,
        uint256 _decimalShift
    ) external returns (bool) {
        _setLimits(
            _targetLimitThresholdMaxPerTxMinPerTxArray,
            _foreignDailyLimitForeignMaxPerTxForeignMinPerTxArray
        );
        _rewardableInitialize(
            _validatorContract,
            _homeGasPrice,
            _requiredBlockConfirmations,
            _erc677token,
            _owner,
            _feeManager,
            _homeFeeForeignFeeArray,
            _decimalShift
        );
        _setBlockRewardContract(_feeManager, _blockReward);
        setInitialize();

        return isInitialized();
    }
}
