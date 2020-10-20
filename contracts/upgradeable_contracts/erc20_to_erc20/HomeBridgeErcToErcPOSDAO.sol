pragma solidity 0.4.24;

import "./HomeBridgeErcToErc.sol";

contract HomeBridgeErcToErcPOSDAO is HomeBridgeErcToErc {
    bytes4 internal constant BLOCK_REWARD_CONTRACT_SELECTOR = 0x56b54bae; // blockRewardContract()
    bytes4 internal constant SET_BLOCK_REWARD_CONTRACT = 0x27a3e16b; // setBlockRewardContract(address)

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

    function blockRewardContract() public view returns (address blockReward) {
        address feeManager = feeManagerContract();
        bytes memory callData = abi.encodeWithSelector(BLOCK_REWARD_CONTRACT_SELECTOR);

        assembly {
            let result := callcode(gas, feeManager, 0x0, add(callData, 0x20), mload(callData), 0, 32)

            if and(eq(returndatasize, 32), result) {
                blockReward := mload(0)
            }
        }
    }

    function setBlockRewardContract(address _blockReward) external onlyOwner {
        address feeManager = feeManagerContract();
        _setBlockRewardContract(feeManager, _blockReward);
    }

    function _setBlockRewardContract(address _feeManager, address _blockReward) internal {
        require(_feeManager.delegatecall(abi.encodeWithSelector(SET_BLOCK_REWARD_CONTRACT, _blockReward)));
    }
}
