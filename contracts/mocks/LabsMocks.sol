pragma solidity 0.4.24;

import "openzeppelin-labs/upgradeability_using_eternal_storage/contracts/UpgradeabilityOwnerStorage.sol";
import "openzeppelin-labs/upgradeability_using_eternal_storage/contracts/UpgradeabilityProxy.sol";
import "openzeppelin-labs/upgradeability_using_eternal_storage/contracts/Proxy.sol";
import "openzeppelin-labs/upgradeability_using_eternal_storage/contracts/UpgradeabilityStorage.sol";

/**
 * @title LabsMocks
 * @dev This contract is not used at all. It is just to workaround an issue with imported dependencies by 0x-sol-compiler
 * used in the test coverage report tool.
 */
// solhint-disable-next-line no-empty-blocks
contract LabsMocks is UpgradeabilityOwnerStorage, Proxy, UpgradeabilityStorage, UpgradeabilityProxy {}
