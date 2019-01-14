pragma solidity 0.4.24;

import "./Ownable.sol";
import "../upgradeability/EternalStorage.sol";

contract BridgeMapper is EternalStorage, Ownable {

  event NewBridgeDeployed(address indexed homeBridge, address indexed foreignBridge, address indexed homeToken, address indexed foreignToken, uint256 homeStratBlock, uint256 foreignStartBlock);

  function homeBridgeByForeignToken(address _foreignToken) public view returns(address) {
    return addressStorage[keccak256(abi.encodePacked("homeBridgeByForeignToken", _foreignToken))];
  }

  function setHomeBridgeByForeignToken(address _foreignToken, address _homeBridge) internal onlyOwner {
    require(_foreignToken != address(0));
    require(_homeBridge != address(0));
    addressStorage[keccak256(abi.encodePacked("homeBridgeByForeignToken", _foreignToken))] = _homeBridge;
  }

  function foreignBridgeByForeignToken(address _foreignToken) public view returns(address) {
    return addressStorage[keccak256(abi.encodePacked("foreignBridgeByForeignToken", _foreignToken))];
  }

  function setForeignBridgeByForeignToken(address _foreignToken, address _foreignBridge) internal onlyOwner {
    require(_foreignToken != address(0));
    require(_foreignBridge != address(0));
    addressStorage[keccak256(abi.encodePacked("foreignBridgeByForeignToken", _foreignToken))] = _foreignBridge;
  }

  function homeTokenByForeignToken(address _foreignToken) public view returns(address) {
    return addressStorage[keccak256(abi.encodePacked("homeTokenByForeignToken", _foreignToken))];
  }

  function setHomeTokenByForeignToken(address _foreignToken, address _homeToken) internal onlyOwner {
    require(_foreignToken != address(0));
    require(_homeToken != address(0));
    addressStorage[keccak256(abi.encodePacked("homeTokenByForeignToken", _foreignToken))] = _homeToken;
  }

  function homeStratBlockByForeignToken(address _foreignToken) public view returns(uint256) {
    return uintStorage[keccak256(abi.encodePacked("homeStratBlockByForeignToken", _foreignToken))];
  }

  function setHomeStratBlockByForeignToken(address _foreignToken, uint256 _homeStratBlock) internal onlyOwner {
    require(_foreignToken != address(0));
    require(_homeStratBlock != 0);
    uintStorage[keccak256(abi.encodePacked("homeStratBlockByForeignToken", _foreignToken))] = _homeStratBlock;
  }

  function foreignStartBlockByForeignToken(address _foreignToken) public view returns(uint256) {
    return uintStorage[keccak256(abi.encodePacked("foreignStartBlockByForeignToken", _foreignToken))];
  }

  function setForeignStartBlockByForeignToken(address _foreignToken, uint256 _foreignStartBlock) internal onlyOwner {
    require(_foreignToken != address(0));
    require(_foreignStartBlock != 0);
    uintStorage[keccak256(abi.encodePacked("foreignStartBlockByForeignToken", _foreignToken))] = _foreignStartBlock;
  }

  function addBridgeMapping(address _homeBridge, address _foreignBridge, address _homeToken, address _foreignToken, uint256 _homeStratBlock, uint256 _foreignStartBlock) public onlyOwner {
    setHomeBridgeByForeignToken(_foreignToken, _homeBridge);
    setForeignBridgeByForeignToken(_foreignToken, _foreignBridge);
    setHomeTokenByForeignToken(_foreignToken, _homeToken);
    setHomeStratBlockByForeignToken(_foreignToken, _homeStratBlock);
    setForeignStartBlockByForeignToken(_foreignToken, _foreignStartBlock);
    emit NewBridgeDeployed(_homeBridge, _foreignBridge, _homeToken, _foreignToken, _homeStratBlock, _foreignStartBlock);
  }

}