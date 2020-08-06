pragma solidity 0.4.24;

import "../Initializable.sol";
import "../VersionableBridge.sol";
import "../BasicAMBMediator.sol";

/**
* @title BasicAMBENSMirror
* @dev Commong mediator functionality for mirroring existing ENS records intended to work on top of AMB bridge.
*/
contract BasicAMBENSMirror is Initializable, BasicAMBMediator, VersionableBridge {
    event BridgeENSNode(bytes32 indexed node, address owner);

    /**
    * @dev Tells the bridge interface version that this contract supports.
    * @return major value of the version
    * @return minor value of the version
    * @return patch value of the version
    */
    function getBridgeInterfacesVersion() external pure returns (uint64 major, uint64 minor, uint64 patch) {
        return (1, 0, 0);
    }

    /**
    * @dev Tells the bridge mode that this contract supports.
    * @return _data 4 bytes representing the bridge mode
    */
    function getBridgeMode() external pure returns (bytes4 _data) {
        return 0xa10d4bc8; // bytes4(keccak256(abi.encodePacked("ens-mirror-amb")))
    }
}
