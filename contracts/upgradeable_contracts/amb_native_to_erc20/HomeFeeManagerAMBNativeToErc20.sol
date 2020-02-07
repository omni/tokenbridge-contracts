pragma solidity 0.4.24;

import "../BaseMediatorFeeManager.sol";
import "../Sacrifice.sol";

/**
* @title HomeFeeManagerAMBNativeToErc20
* @dev Implements the logic to distribute fees from the native to erc20 mediator contract operations.
* The fees are distributed in the form of native tokens to the list of reward accounts.
* This contract is intended to be used as a logic contract only. The address of this contract should be stored in the
* mediator contract and the methods should be invoked by using delegatecall or callcode so it can access the state
* of the mediator contracts.
*/
contract HomeFeeManagerAMBNativeToErc20 is BaseMediatorFeeManager {
    /**
    * @dev Transfer the fee as native coins to the reward account.
    * If the send operation fails because the account is not able to receive the native tokens, a selfdestruct contract
    * is deployed with the fee amount and sets the reward account as recipient to receive its native tokens.
    * @param _rewardAddress address that will receive the native tokens.
    * @param _fee amount of native tokens to be distribute.
    */
    function onFeeDistribution(address _rewardAddress, uint256 _fee) internal {
        if (!_rewardAddress.send(_fee)) {
            (new Sacrifice).value(_fee)(_rewardAddress);
        }
    }
}
