pragma solidity 0.4.24;

import "../../interfaces/IBlockReward.sol";
import "../../libraries/Address.sol";
import "../BaseMediatorFeeManagerBothDirections.sol";

/**
* @title HomeFeeManagerAMBErc20ToNative
* @dev Implements the logic to distribute fees from the erc20 to native mediator contract operations.
* The fees are distributed in the form of native tokens to the list of reward accounts.
*/
contract HomeFeeManagerAMBErc20ToNative is BaseMediatorFeeManagerBothDirections {
    address public blockReward;

    /**
    * @dev Stores the initial parameters of the fee manager.
    * @param _owner address of the owner of the fee manager contract.
    * @param _fee the fee percentage amount.
    * @param _rewardAccountList list of addresses that will receive the fee rewards.
    */
    constructor(
        address _owner,
        uint256 _fee,
        uint256 _oppositeFee,
        address[] _rewardAccountList,
        address _mediatorContract,
        address _blockReward
    ) public BaseMediatorFeeManagerBothDirections(_owner, _fee, _oppositeFee, _rewardAccountList, _mediatorContract) {
        blockReward = _blockReward;
    }

    /**
    * @dev Fallback method to receive the fees.
    */
    function() public payable {
        // solhint-disable-previous-line no-empty-blocks
    }

    /**
    * @dev Transfer the fee as native tokens to the reward account.
    * @param _rewardAddress address that will receive the native tokens.
    * @param _fee amount of native tokens to be distribute.
    */
    function onFeeDistribution(address _rewardAddress, uint256 _fee) internal {
        if (isOppositeDirection) {
            IBlockReward(blockReward).addExtraReceiver(_fee, _rewardAddress);
        } else {
            Address.safeSendValue(_rewardAddress, _fee);
        }
    }

    function distributeOppositeFee(uint256 _fee) public {
        require(msg.sender == mediatorContract);
        super.distributeOppositeFee(_fee);
    }
}
