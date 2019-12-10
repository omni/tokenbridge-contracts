pragma solidity 0.4.24;

import "./HomeBridgeErcToErc.sol";

contract HomeBridgeErcToErcPOSDAO is HomeBridgeErcToErc {
    bytes4 internal constant BLOCK_REWARD_CONTRACT_SELECTOR = 0x56b54bae; // blockRewardContract()
    bytes4 internal constant SET_BLOCK_REWARD_CONTRACT = 0x27a3e16b; // setBlockRewardContract(address)

    function rewardableInitialize(
        address _validatorContract,
        // absolute: [ 0 = _dailyLimit, 1 = _maxPerTx, 2 = _minPerTx ]
        // relative: [ 0 = _targetLimit, 1 = _threshold, 2 = _maxPerTx, 3 = _minPerTx ]
        uint256[] _requestLimitsArray,
        uint256 _homeGasPrice,
        uint256 _requiredBlockConfirmations,
        address _erc677token,
        uint256[] _executionLimitsArray, // [ 0 = _executionDailyLimit, 1 = _executionMaxPerTx, 2 = _executionMinPerTx ]
        address _owner,
        address _feeManager,
        uint256[] _homeFeeForeignFeeArray, // [ 0 = _homeFee, 1 = _foreignFee ]
        uint256 _decimalShift,
        address _blockReward,
        address _limitsContract
    ) public returns (bool) {
        _setBlockRewardContract(_feeManager, _blockReward);
        return super.rewardableInitialize(
            _validatorContract,
            _requestLimitsArray,
            _homeGasPrice,
            _requiredBlockConfirmations,
            _erc677token,
            _executionLimitsArray,
            _owner,
            _feeManager,
            _homeFeeForeignFeeArray,
            _decimalShift,
            _limitsContract
        );
    }

    function blockRewardContract() public view returns (address) {
        address blockReward;
        address feeManager = feeManagerContract();
        bytes memory callData = abi.encodeWithSelector(BLOCK_REWARD_CONTRACT_SELECTOR);

        assembly {
            let result := callcode(gas, feeManager, 0x0, add(callData, 0x20), mload(callData), 0, 32)
            blockReward := mload(0)

            switch result
                case 0 {
                    revert(0, 0)
                }
        }

        return blockReward;
    }

    function setBlockRewardContract(address _blockReward) external onlyOwner {
        address feeManager = feeManagerContract();
        _setBlockRewardContract(feeManager, _blockReward);
    }

    function _setBlockRewardContract(address _feeManager, address _blockReward) internal {
        require(_feeManager.delegatecall(abi.encodeWithSelector(SET_BLOCK_REWARD_CONTRACT, _blockReward)));
    }
}
