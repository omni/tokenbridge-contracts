pragma solidity 0.4.24;

import "./EternalStorage.sol";
import "./OwnedUpgradeabilityProxy.sol";

/**
 * @title EternalStorageProxy
 * @dev This proxy holds the storage of the token contract and delegates every call to the current implementation set.
 * Besides, it allows to upgrade the token's behaviour towards further implementations, and provides basic
 * authorization control functionalities
 */
// solhint-disable-next-line no-empty-blocks
contract EternalStorageProxy is EternalStorage, OwnedUpgradeabilityProxy {
    bytes32 internal constant OWNER = 0x02016836a56b71f0d02689e69e326f4f4c1b9057164ef592671cf0d37c8040c0; // keccak256(abi.encodePacked("owner"))

    constructor() public {
        // set initial owner in proxy storage to contract deployer
        addressStorage[OWNER] = msg.sender;
    }
}
