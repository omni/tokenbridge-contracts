pragma solidity 0.4.24;


interface IOwnedUpgradeabilityProxy {
    function proxyOwner() public view returns (address);
}
