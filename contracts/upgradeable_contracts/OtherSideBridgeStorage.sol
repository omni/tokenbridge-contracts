pragma solidity 0.4.24;

import "../upgradeability/EternalStorage.sol";

contract OtherSideBridgeStorage is EternalStorage {
    bytes32 internal constant BRIDGE_CONTRACT = 0x71483949fe7a14d16644d63320f24d10cf1d60abecc30cc677a340e82b699dd2; // keccak256(abi.encodePacked("bridgeOnOtherSide"))

    function _setBridgeContractOnOtherSide(address _bridgeContract) internal {
        require(_bridgeContract != address(0));
        addressStorage[BRIDGE_CONTRACT] = _bridgeContract;
    }

    function bridgeContractOnOtherSide() internal view returns (address) {
        return addressStorage[BRIDGE_CONTRACT];
    }
}
