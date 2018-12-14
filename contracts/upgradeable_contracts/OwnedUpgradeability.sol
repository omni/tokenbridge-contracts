pragma solidity 0.4.24;

import "../IOwnedUpgradeabilityProxy.sol";


contract OwnedUpgradeability {

    function upgradeabilityAdmin() public view returns (address) {
        return IOwnedUpgradeabilityProxy(this).proxyOwner();
    }

    modifier onlyProxyOwner() {
        require(msg.sender == upgradeabilityAdmin());
        _;
    }
}
