pragma solidity 0.4.24;

import "openzeppelin-solidity/contracts/AddressUtils.sol";
import "openzeppelin-labs/upgradeability_using_eternal_storage/contracts/EternalStorage.sol";
import "openzeppelin-labs/upgradeability_using_eternal_storage/contracts/OwnedUpgradeabilityProxy.sol";

contract EternalStorageProxy is EternalStorage, OwnedUpgradeabilityProxy {
    function upgradeTo(string version, address implementation) public {
        require(AddressUtils.isContract(implementation));
        super.upgradeTo(version, implementation);
    }
}
