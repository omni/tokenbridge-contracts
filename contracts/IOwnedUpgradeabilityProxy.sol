pragma solidity 0.4.19;


interface IOwnedUpgradeabilityProxy {
    function proxyOwner() public view returns (address);
}
