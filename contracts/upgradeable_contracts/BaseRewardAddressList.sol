pragma solidity 0.4.24;

import "./BaseAddressList.sol";
import "./Ownable.sol";

/**
* @title BaseRewardAddressList
* @dev Implements the logic to store, add and remove reward account addresses. Works as an array list.
*/
contract BaseRewardAddressList is BaseAddressList, Ownable {
    event RewardAddressAdded(address indexed addr);
    event RewardAddressRemoved(address indexed addr);

    /**
     * @dev Retrieves all registered reward accounts.
     * @return address list of the registered reward receivers.
     */
    function rewardAddressList() external view returns (address[]) {
        return _addressList();
    }

    /**
     * @dev Retrieves amount of registered reward accounts.
     * @return length of reward addresses list.
     */
    function rewardAddressCount() public view returns (uint256) {
        return _addressCount();
    }

    /**
     * @dev Checks if specified address is included into the registered rewards receivers list.
     * @param _addr address to verify.
     * @return true, if specified address is associated with one of the registered reward accounts.
     */
    function isRewardAddress(address _addr) external view returns (bool) {
        uint256 count = _addressCount();
        return _addressIndex(_addr, count) < count;
    }

    /**
     * @dev Adds a new reward address to the list, which will receive fees collected from the bridge operations.
     * Only the owner can call this method.
     * @param _addr new reward account.
     */
    function addRewardAddress(address _addr) external onlyOwner {
        _addAddress(_addr);

        emit RewardAddressAdded(_addr);
    }

    /**
     * @dev Removes a reward address from the rewards list.
     * Only the owner can call this method.
     * @param _addr old reward account, that should be removed.
     */
    function removeRewardAddress(address _addr) external onlyOwner {
        _removeAddress(_addr);

        emit RewardAddressRemoved(_addr);
    }

    /**
     * @dev Internal function for initializing array list with initial reward addresses.
     * @param _rewardAddresses initial reward addresses list.
     */
    function _setRewardAddressList(address[] _rewardAddresses) internal {
        _initAddresses(_rewardAddresses);

        for (uint256 i = 0; i < _rewardAddresses.length; i++) {
            emit RewardAddressAdded(_rewardAddresses[i]);
        }
    }
}
