pragma solidity ^0.4.19;


contract BridgeDeploymentAddressStorage {
    uint256 public deployedAtBlock;

    function BridgeDeploymentAddressStorage() public {
        deployedAtBlock = block.number;
    }
}
