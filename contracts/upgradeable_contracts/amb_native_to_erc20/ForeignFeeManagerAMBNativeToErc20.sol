pragma solidity 0.4.24;

import "../BaseMediatorFeeManager.sol";
import "../../interfaces/IBurnableMintableERC677Token.sol";
import "../ERC677Storage.sol";

/**
* @title ForeignFeeManagerAMBNativeToErc20
* @dev Implements the logic to distribute fees from the native to erc20 mediator contract operations.
* The fees are distributed in the form of tokens to the list of reward accounts.
* This contract is intended to be used as a logic contract only. The address of this contract should be stored in the
* mediator contract and the methods should be invoked by using delegatecall or callcode so it can access the state
* of the mediator contracts.
*/
contract ForeignFeeManagerAMBNativeToErc20 is BaseMediatorFeeManager, ERC677Storage {
    /**
    * @dev Mint the fee amount of tokens to the reward account.
    * @param _rewardAddress address that will receive the minted tokens.
    * @param _fee amount of tokens to be minted.
    */
    function onFeeDistribution(address _rewardAddress, uint256 _fee) internal {
        erc677token().mint(_rewardAddress, _fee);
    }

    /**
    * @dev Tells the erc677 token address owned by the mediator.
    * @return the address of the erc677 token.
    */
    function erc677token() internal view returns (IBurnableMintableERC677Token) {
        return IBurnableMintableERC677Token(addressStorage[ERC677_TOKEN]);
    }
}
