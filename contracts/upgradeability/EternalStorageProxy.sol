pragma solidity 0.4.24;

import "openzeppelin-labs/upgradeability_using_eternal_storage/contracts/EternalStorage.sol";
import "openzeppelin-labs/upgradeability_using_eternal_storage/contracts/OwnedUpgradeabilityProxy.sol";

contract EternalStorageProxy is EternalStorage, OwnedUpgradeabilityProxy {}