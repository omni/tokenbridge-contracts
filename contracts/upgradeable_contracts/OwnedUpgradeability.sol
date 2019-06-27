pragma solidity 0.4.24;

import "../interfaces/IOwnedUpgradeabilityProxy.sol";


contract OwnedUpgradeability {
    // Avoid using onlyProxyOwner name to prevent issues with implementation from proxy contract
    modifier onlyIfOwnerOfProxy() {
        require(msg.sender == IOwnedUpgradeabilityProxy(this).upgradeabilityOwner());
        _;
    }
}
