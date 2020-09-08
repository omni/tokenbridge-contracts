pragma solidity 0.4.24;

import "openzeppelin-solidity/contracts/AddressUtils.sol";
import "./Proxy.sol";
import "./UpgradeabilityStorage.sol";

/**
 * @title UpgradeabilityProxy
 * @dev This contract represents a proxy where the implementation address to which it will delegate can be upgraded
 */
contract UpgradeabilityProxy is Proxy, UpgradeabilityStorage {
    /**
     * @dev This event will be emitted every time the implementation gets upgraded
     * @param version representing the version name of the upgraded implementation
     * @param implementation representing the address of the upgraded implementation
     */
    event Upgraded(uint256 version, address indexed implementation);

    /**
     * @dev Upgrades the implementation address
     * @param version representing the version name of the new implementation to be set
     * @param implementation representing the address of the new implementation to be set
     */
    function _upgradeTo(uint256 version, address implementation) internal {
        require(_implementation != implementation);

        // This additional check verifies that provided implementation is at least a contract
        require(AddressUtils.isContract(implementation));

        // This additional check guarantees that new version will be at least greater than the privios one,
        // so it is impossible to reuse old versions, or use the last version twice
        require(version > _version);

        _version = version;
        _implementation = implementation;
        emit Upgraded(version, implementation);
    }
}
