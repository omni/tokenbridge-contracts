pragma solidity 0.4.24;

import "../../upgradeability/EternalStorage.sol";

/**
* @title MultiTokenBridgedRegistry
* @dev Common functionality for keeping track of registered bridged tokens pairs for multi-erc20-to-erc677 mediator.
*/
contract MultiTokenBridgedRegistry is EternalStorage {
    event NewTokenRegistered(address indexed nativeToken, address indexed bridgedToken);

    /**
    * @dev Retrieves address of the bridged token contract associated with a specific native token contract on the other side.
    * @param _nativeToken address of the native token contract on the other side.
    * @return address of the deployed bridged token contract.
    */
    function bridgedTokenAddress(address _nativeToken) public view returns (address) {
        return addressStorage[keccak256(abi.encodePacked("homeTokenAddress", _nativeToken))];
    }

    /**
    * @dev Retrieves address of the native token contract associated with a specific bridged token contract.
    * @param _bridgedToken address of the created bridged token contract on this side.
    * @return address of the native token contract on the other side of the bridge.
    */
    function nativeTokenAddress(address _bridgedToken) public view returns (address) {
        return addressStorage[keccak256(abi.encodePacked("foreignTokenAddress", _bridgedToken))];
    }

    /**
    * @dev Internal function for updating a pair of addresses for the bridged token.
    * @param _nativeToken address of the native token contract on the other side.
    * @param _bridgedToken address of the created bridged token contract on this side.
    */
    function _setTokenAddressPair(address _nativeToken, address _bridgedToken) internal {
        addressStorage[keccak256(abi.encodePacked("homeTokenAddress", _nativeToken))] = _bridgedToken;
        addressStorage[keccak256(abi.encodePacked("foreignTokenAddress", _bridgedToken))] = _nativeToken;

        emit NewTokenRegistered(_nativeToken, _bridgedToken);
    }
}
