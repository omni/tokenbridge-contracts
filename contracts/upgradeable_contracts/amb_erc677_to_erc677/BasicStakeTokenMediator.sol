pragma solidity 0.4.24;

import "./BasicAMBErc677ToErc677.sol";

contract BasicStakeTokenMediator is BasicAMBErc677ToErc677 {
    function getBridgeInterfacesVersion() external pure returns (uint64 major, uint64 minor, uint64 patch) {
        return (1, 3, 0);
    }

    function getBridgeMode() external pure returns (bytes4 _data) {
        return 0x16ea01e9; // bytes4(keccak256(abi.encodePacked("stake-erc-to-erc-amb")))
    }
}
