pragma solidity 0.4.24;


interface IOwnedUpgradeabilityProxy {
    function upgradeabilityOwner() public view returns (address);
}
