pragma solidity 0.4.24;

import "./HomeBridgeErcToErc.sol";

contract HomeBridgeErcToErcPOSDAO is HomeBridgeErcToErc {
    bytes4 internal constant BLOCK_REWARD_CONTRACT_SELECTOR = 0x56b54bae; // blockRewardContract()
    bytes4 internal constant SET_BLOCK_REWARD_CONTRACT = 0x27a3e16b; // setBlockRewardContract(address)

    function rewardableInitialize(
        address[] _contracts, // [ 0 = _validatorContract, 1 = _erc677token, 2 = _feeManager, 3 = _limitsContract, 4 = _blockReward ]
        uint256[] _requestLimitsArray, // [ 0 = _dailyLimit, 1 = _maxPerTx, 2 = _minPerTx ]
        uint256 _homeGasPrice,
        uint256 _requiredBlockConfirmations,
        uint256[] _executionLimitsArray, // [ 0 = _foreignDailyLimit, 1 = _foreignMaxPerTx, 2 = _foreignMinPerTx ]
        address _owner,
        uint256[] _homeFeeForeignFeeArray, // [ 0 = _homeFee, 1 = _foreignFee ]
        uint256 _decimalShift
    ) external returns (bool) {
        require(AddressUtils.isContract(_contracts[3]));
        addressStorage[LIMITS_CONTRACT] = _contracts[3];
        _setLimits(_requestLimitsArray, _executionLimitsArray);
        _rewardableInitialize(
            _contracts,
            _homeGasPrice,
            _requiredBlockConfirmations,
            _owner,
            _homeFeeForeignFeeArray,
            _decimalShift
        );
        _setBlockRewardContract(_contracts[2], _contracts[4]);
        setInitialize();

        return isInitialized();
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
