pragma solidity 0.4.24;

contract ERC677Storage {
    bytes32 internal constant ERC677_TOKEN = keccak256(abi.encodePacked("erc677token"));
}
