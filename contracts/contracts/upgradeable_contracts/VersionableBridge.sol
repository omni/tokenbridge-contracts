pragma solidity 0.4.24;

contract VersionableBridge {
    function getBridgeInterfacesVersion()
        external
        pure
        returns (
            uint64 major,
            uint64 minor,
            uint64 patch
        )
    {
        return (5, 1, 0);
    }

    /* solcov ignore next */
    function getBridgeMode() external pure returns (bytes4);
}
