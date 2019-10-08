pragma solidity 0.4.24;

import "../upgradeability/EternalStorage.sol";

contract OtherSideBridgeStorage is EternalStorage {
    bytes32 internal constant BRIDGE_CONTRACT = keccak256(abi.encodePacked("bridgeOnOtherSide"));

    function _setBridgeContractOnOtherSide(address _bridgeContract) internal {
        addressStorage[BRIDGE_CONTRACT] = _bridgeContract;
    }

    function bridgeContractOnOtherSide() public view returns (address) {
        return addressStorage[BRIDGE_CONTRACT];
    }
}
