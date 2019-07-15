pragma solidity 0.4.24;

import "./UpgradeabilityProxy.sol";
import "./UpgradeabilityOwnerStorage.sol";


/**
 * @title OwnedUpgradeabilityProxy
 * @dev This contract combines an upgradeability proxy with basic authorization control functionalities
 */
contract OwnedUpgradeabilityProxy is UpgradeabilityOwnerStorage, UpgradeabilityProxy {
  /**
  * @dev Event to show ownership has been transferred
  * @param previousOwner representing the address of the previous owner
  * @param newOwner representing the address of the new owner
  */
    event ProxyOwnershipTransferred(address previousOwner, address newOwner);

    /**
    * @dev the constructor sets the original owner of the contract to the sender account.
    */
    constructor() public {
        setUpgradeabilityOwner(msg.sender);
    }

    /**
    * @dev Throws if called by any account other than the owner.
    */
    modifier onlyUpgradeabilityOwner() {
        require(msg.sender == upgradeabilityOwner());
        _;
    }

    /**
    * @dev Allows the current owner to transfer control of the contract to a newOwner.
    * @param newOwner The address to transfer ownership to.
    */
    function transferProxyOwnership(address newOwner) external onlyUpgradeabilityOwner {
        require(newOwner != address(0));
        emit ProxyOwnershipTransferred(upgradeabilityOwner(), newOwner);
        setUpgradeabilityOwner(newOwner);
    }

    /**
    * @dev Allows the upgradeability owner to upgrade the current version of the proxy.
    * @param version representing the version name of the new implementation to be set.
    * @param implementation representing the address of the new implementation to be set.
    */
    function upgradeTo(uint256 version, address implementation) public onlyUpgradeabilityOwner {
        _upgradeTo(version, implementation);
    }

    /**
    * @dev Allows the upgradeability owner to upgrade the current version of the proxy and call the new implementation
    * to initialize whatever is needed through a low level call.
    * @param version representing the version name of the new implementation to be set.
    * @param implementation representing the address of the new implementation to be set.
    * @param data represents the msg.data to bet sent in the low level call. This parameter may include the function
    * signature of the implementation to be called with the needed payload
    */
    function upgradeToAndCall(uint256 version, address implementation, bytes data) payable external onlyUpgradeabilityOwner {
        upgradeTo(version, implementation);
        require(address(this).call.value(msg.value)(data));
    }
}
