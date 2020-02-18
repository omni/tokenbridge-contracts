pragma solidity 0.4.24;

import "./HomeAMBNativeToErc20.sol";

/**
* @title ClassicHomeAMBNativeToErc20
* @dev Home mediator implementation for native-to-erc20 bridge intended to work on top of AMB bridge.
* It is design to be used as implementation contract of ClassicEternalStorageProxy contract.
* The only difference between this contract and HomeAMBNativeToErc20 is that it stores and updates the size of the
* returned value by rewardAccounts() method.
*/
contract ClassicHomeAMBNativeToErc20 is HomeAMBNativeToErc20 {
    bytes32 internal constant REWARD_LIST_RETURN_SIZE = 0x4c157fdae1aad54c5b9d1022fde87a37b4e0605939ce16f1f6eb9c83fbe141db; // keccak256(abi.encodePacked("dataSizes", bytes4(keccak256("rewardAccounts()"))))

    /**
    * @dev Adds a new account to the list of accounts to receive rewards for the operations. Only the owner can call this method.
    * The logic of how the list of reward accounts is stored is delegated to the fee manager contract.
    * It also updates the size of the reward account list to be returned by rewardAccounts().
    * It is needed when using ClassicEternalStorageProxy
    * @param _account new reward account
    */
    function addRewardAccount(address _account) external onlyOwner {
        require(feeManagerContract().delegatecall(abi.encodeWithSelector(ADD_REWARD_ACCOUNT, _account)));
        uintStorage[REWARD_LIST_RETURN_SIZE] = uintStorage[REWARD_LIST_RETURN_SIZE] + 32;
    }

    /**
    * @dev Removes an account from the list of accounts to receive rewards for the operations. Only the owner can call this method.
    * The logic of how the list of reward accounts is stored is delegated to the fee manager contract.
    * It also updates the size of the reward account list to be returned by rewardAccounts().
    * It is needed when using ClassicEternalStorageProxy
    * @param _account to be removed
    */
    function removeRewardAccount(address _account) external {
        require(feeManagerContract().delegatecall(abi.encodeWithSelector(REMOVE_REWARD_ACCOUNT, _account)));
        uintStorage[REWARD_LIST_RETURN_SIZE] = uintStorage[REWARD_LIST_RETURN_SIZE] - 32;
    }

    /**
    * @dev Initialize the list of accounts that receives rewards for the mediator operations.
    * The logic of how the list of reward accounts is stored is delegated to the fee manager contract.
    * It also stores the size of the reward account list to be returned by rewardAccounts().
    * It is needed when using ClassicEternalStorageProxy
    * @param _accounts list of accounts
    */
    function _initializeRewardAccounts(address[] _accounts) internal {
        super._initializeRewardAccounts(_accounts);
        // 32 for bytes length + 32 for array length + 32 for each account _accounts.length
        uint256 size = 32 + 32 + 32 * _accounts.length;
        uintStorage[REWARD_LIST_RETURN_SIZE] = size;
    }
}
