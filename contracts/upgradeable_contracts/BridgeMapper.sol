pragma solidity 0.4.24;

import "./EternalOwnable.sol";
import "../upgradeability/EternalStorage.sol";

contract BridgeMapper is EternalStorage, EternalOwnable {

  event BridgeMappingAdded(address indexed foreignToken, address homeToken, address foreignBridge, address homeBridge, uint256 foreignStartBlock, uint256 homeStartBlock);
  event BridgeMappingRemoved(address indexed foreignToken);

  function homeBridgeByForeignToken(address _foreignToken) public view returns(address) {
    return addressStorage[keccak256(abi.encodePacked("homeBridgeByForeignToken", _foreignToken))];
  }

  function setHomeBridgeByForeignToken(address _foreignToken, address _homeBridge) internal {
    addressStorage[keccak256(abi.encodePacked("homeBridgeByForeignToken", _foreignToken))] = _homeBridge;
  }

  function foreignBridgeByForeignToken(address _foreignToken) public view returns(address) {
    return addressStorage[keccak256(abi.encodePacked("foreignBridgeByForeignToken", _foreignToken))];
  }

  function setForeignBridgeByForeignToken(address _foreignToken, address _foreignBridge) internal {
    addressStorage[keccak256(abi.encodePacked("foreignBridgeByForeignToken", _foreignToken))] = _foreignBridge;
  }

  function homeTokenByForeignToken(address _foreignToken) public view returns(address) {
    return addressStorage[keccak256(abi.encodePacked("homeTokenByForeignToken", _foreignToken))];
  }

  function setHomeTokenByForeignToken(address _foreignToken, address _homeToken) internal {
    addressStorage[keccak256(abi.encodePacked("homeTokenByForeignToken", _foreignToken))] = _homeToken;
  }

  function homeStartBlockByForeignToken(address _foreignToken) public view returns(uint256) {
    return uintStorage[keccak256(abi.encodePacked("homeStartBlockByForeignToken", _foreignToken))];
  }

  function setHomeStartBlockByForeignToken(address _foreignToken, uint256 _homeStartBlock) internal {
    uintStorage[keccak256(abi.encodePacked("homeStartBlockByForeignToken", _foreignToken))] = _homeStartBlock;
  }

  function foreignStartBlockByForeignToken(address _foreignToken) public view returns(uint256) {
    return uintStorage[keccak256(abi.encodePacked("foreignStartBlockByForeignToken", _foreignToken))];
  }

  function setForeignStartBlockByForeignToken(address _foreignToken, uint256 _foreignStartBlock) internal {
    uintStorage[keccak256(abi.encodePacked("foreignStartBlockByForeignToken", _foreignToken))] = _foreignStartBlock;
  }

  function addBridgeMapping(address _foreignToken, address _homeToken, address _foreignBridge, address _homeBridge, uint256 _foreignStartBlock, uint256 _homeStartBlock) public onlyOwner {
    require(_foreignToken != address(0));
    require(_homeToken != address(0));
    require(_foreignBridge != address(0));
    require(_homeBridge != address(0));
    require(_foreignStartBlock > 0);
    require(_homeStartBlock > 0);
    setHomeTokenByForeignToken(_foreignToken, _homeToken);
    setForeignBridgeByForeignToken(_foreignToken, _foreignBridge);
    setHomeBridgeByForeignToken(_foreignToken, _homeBridge);
    setForeignStartBlockByForeignToken(_foreignToken, _foreignStartBlock);
    setHomeStartBlockByForeignToken(_foreignToken, _homeStartBlock);
    emit BridgeMappingAdded(_foreignToken, _homeToken, _foreignBridge, _homeBridge, _foreignStartBlock, _homeStartBlock);
  }

  function removeBridgeMapping(address _foreignToken) public onlyOwner {
    require(_foreignToken != address(0));
    setHomeTokenByForeignToken(_foreignToken, address(0));
    setForeignBridgeByForeignToken(_foreignToken, address(0));
    setHomeBridgeByForeignToken(_foreignToken, address(0));
    setForeignStartBlockByForeignToken(_foreignToken, 0);
    setHomeStartBlockByForeignToken(_foreignToken, 0);
    emit BridgeMappingRemoved(_foreignToken);
  }

  function getBridgeMapperVersion() public pure returns(uint64 major, uint64 minor, uint64 patch) {
    return (2, 2, 0);
  }

  function initialize(address _owner) public {
    setOwner(_owner);
  }

}