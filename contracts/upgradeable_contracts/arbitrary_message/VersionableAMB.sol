pragma solidity 0.4.24;

import "../VersionableBridge.sol";

contract VersionableAMB is VersionableBridge {
    // bridge version as a single 4-bytes number, included into every outgoing relay request
    uint32 internal constant ENCODED_BRIDGE_VERSION = 0x00040000;

    /**
     * Returns currently used bridge version
     * @return (major, minor, patch) version triple
     */
    function getBridgeInterfacesVersion() external pure returns (uint64 major, uint64 minor, uint64 patch) {
        return (4, 0, 0);
    }
}
