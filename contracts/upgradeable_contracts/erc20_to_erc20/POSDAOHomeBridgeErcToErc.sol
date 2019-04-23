pragma solidity 0.4.24;

import "./HomeBridgeErcToErc.sol";

contract POSDAOHomeBridgeErcToErc is HomeBridgeErcToErc {

    function rewardableInitialize (
        address _validatorContract,
        uint256 _dailyLimit,
        uint256 _maxPerTx,
        uint256 _minPerTx,
        uint256 _homeGasPrice,
        uint256 _requiredBlockConfirmations,
        address _erc677token,
        uint256 _foreignDailyLimit,
        uint256 _foreignMaxPerTx,
        address _owner,
        address _feeManager,
        uint256 _homeFee,
        uint256 _foreignFee,
        address _blockReward
    ) public
    returns(bool)
    {
        _rewardableInitialize (
            _validatorContract,
            _dailyLimit,
            _maxPerTx,
            _minPerTx,
            _homeGasPrice,
            _requiredBlockConfirmations,
            _erc677token,
            _foreignDailyLimit,
            _foreignMaxPerTx,
            _owner,
            _feeManager,
            _homeFee,
            _foreignFee
        );
        _setBlockRewardContract(_feeManager, _blockReward);
        setInitialize(true);

        return isInitialized();
    }

    function blockRewardContract() public view returns(address) {
        address blockReward;
        address feeManager = feeManagerContract();
        bytes memory callData = abi.encodeWithSignature("blockRewardContract()");

        assembly {
            let result := callcode(gas, feeManager, 0x0, add(callData, 0x20), mload(callData), 0, 32)
            blockReward := mload(0)

            switch result
            case 0 { revert(0, 0) }
        }

        return blockReward;
    }

    function setBlockRewardContract(address _blockReward) public onlyOwner {
        address feeManager = feeManagerContract();
        _setBlockRewardContract(feeManager, _blockReward);
    }

    function _setBlockRewardContract(address _feeManager, address _blockReward) internal {
        require(_feeManager.delegatecall(abi.encodeWithSignature("setBlockRewardContract(address)", _blockReward)));
    }
}
