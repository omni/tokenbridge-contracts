pragma solidity 0.4.23;


interface IOwnedUpgradeabilityProxy {
    function proxyOwner() public view returns (address);
}
