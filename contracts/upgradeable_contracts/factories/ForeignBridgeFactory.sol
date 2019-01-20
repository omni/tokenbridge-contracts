pragma solidity 0.4.24;

import "../../IBridgeValidators.sol";
import "../../IForeignBridge.sol";
import "../../upgradeability/EternalStorageProxy.sol";
import "../../upgradeability/EternalStorage.sol";
import "../EternalOwnable.sol";

contract ForeignBridgeFactory is EternalStorage, EternalOwnable {

  event ForeignBridgeDeployed(address indexed _foreignBridge, address indexed _foreignValidators, uint256 _blockNumber);

  function getBridgeFactoryVersion() public pure returns(uint64 major, uint64 minor, uint64 patch) {
    return (2, 2, 0);
  }

  function initialize(address _owner,
      address _bridgeValidatorsImplementation,
      uint256 _requiredSignatures,
      address[] _initialValidators,
      address _bridgeValidatorsOwner,
      address _foreignBridgeErcToErcImplementation,
      uint256 _requiredBlockConfirmations,
      uint256 _gasPrice,
      uint256 _foreignMaxPerTx,
      uint256 _homeDailyLimit,
      uint256 _homeMaxPerTx,
      address _foreignBridgeOwner,
      address _foreignProxyOwner) public {

    
    require(_owner != address(0));
    require(_bridgeValidatorsImplementation != address(0));
    require(_requiredSignatures >= 1);
    require(_bridgeValidatorsOwner != address(0));
    require(_foreignBridgeErcToErcImplementation != address(0));
    require(_requiredBlockConfirmations != 0);
    require(_gasPrice > 0);
    require(_foreignMaxPerTx >= 0);
    require(_homeMaxPerTx < _homeDailyLimit);
    require(_foreignBridgeOwner != address(0));
    require(_foreignProxyOwner != address(0));

    setOwner(_owner);
    setBridgeValidatorsImplementation(_bridgeValidatorsImplementation);
    setRequiredSignatures(_requiredSignatures);
    setInitialValidators(_initialValidators);
    setBridgeValidatorsOwner(_bridgeValidatorsOwner);
    setBridgeValidatorsProxyOwner(_foreignProxyOwner);
    setForeignBridgeErcToErcImplementation(_foreignBridgeErcToErcImplementation);
    setRequiredBlockConfirmations(_requiredBlockConfirmations);
    setGasPrice(_gasPrice);
    setForeignMaxPerTx(_foreignMaxPerTx);
    setHomeDailyLimit(_homeDailyLimit);
    setHomeMaxPerTx(_homeMaxPerTx);
    setForeignBridgeOwner(_foreignBridgeOwner);
    setForeignBridgeProxyOwner(_foreignProxyOwner);
  }

  function deployForeignBridge(address _erc20Token) public onlyOwner {
    // deploy new EternalStorageProxy
    EternalStorageProxy proxy = new EternalStorageProxy();
    // connect it to the static BridgeValidators implementation
    proxy.upgradeTo(1, bridgeValidatorsImplementation());
    // cast proxy as IBridgeValidators
    IBridgeValidators bridgeValidators = IBridgeValidators(proxy);
    // initialize bridgeValidators
    bridgeValidators.initialize(requiredSignatures(), initialValidators(), bridgeValidatorsOwner());
    // transger proxy upgradeability admin
    proxy.transferProxyOwnership(bridgeValidatorsProxyOwner());
    // deploy new EternalStorageProxy
    proxy = new EternalStorageProxy();
    // connect it to the static ForeignBridgeErcToErc implementation
    proxy.upgradeTo(1, foreignBridgeErcToErcImplementation());
    // cast proxy as IForeignBridge
    IForeignBridge foreignBridge = IForeignBridge(proxy);
    // initialize foreignBridge
    foreignBridge.initialize(bridgeValidators, _erc20Token, requiredBlockConfirmations(), gasPrice(), foreignMaxPerTx(), homeDailyLimit(), homeMaxPerTx(), foreignBridgeOwner());
    // transger proxy upgradeability admin
    proxy.transferProxyOwnership(foreignBridgeProxyOwner());
    // emit event
    emit ForeignBridgeDeployed(foreignBridge, bridgeValidators, block.number);
  }
  

  function bridgeValidatorsImplementation() public view returns(address) {
    return addressStorage[keccak256(abi.encodePacked("bridgeValidatorsImplementation"))];
  }

  function setBridgeValidatorsImplementation(address _bridgeValidatorsImplementation) public onlyOwner {
    addressStorage[keccak256(abi.encodePacked("bridgeValidatorsImplementation"))] = _bridgeValidatorsImplementation;
  }

  function requiredSignatures() public view returns(uint256) {
    return uintStorage[keccak256(abi.encodePacked("requiredSignatures"))];
  }

  function setRequiredSignatures(uint256 _requiredSignatures) public onlyOwner {
    uintStorage[keccak256(abi.encodePacked("requiredSignatures"))] = _requiredSignatures;
  }

  function initialValidators() public view returns(address[]) {
    return addressArrayStorage[keccak256(abi.encodePacked("initialValidators"))];
  }

  function setInitialValidators(address[] _initialValidators) public onlyOwner {
    addressArrayStorage[keccak256(abi.encodePacked("initialValidators"))] = _initialValidators;
  }

  function bridgeValidatorsOwner() public view returns(address) {
    return addressStorage[keccak256(abi.encodePacked("bridgeValidatorsOwner"))];
  }

  function setBridgeValidatorsOwner(address _bridgeValidatorsOwner) public onlyOwner {
    addressStorage[keccak256(abi.encodePacked("bridgeValidatorsOwner"))] = _bridgeValidatorsOwner;
  }

  function bridgeValidatorsProxyOwner() public view returns(address) {
    return addressStorage[keccak256(abi.encodePacked("bridgeValidatorsProxyOwner"))];
  }

  function setBridgeValidatorsProxyOwner(address _bridgeValidatorsProxyOwner) public onlyOwner {
    addressStorage[keccak256(abi.encodePacked("bridgeValidatorsProxyOwner"))] = _bridgeValidatorsProxyOwner;
  }

  function foreignBridgeErcToErcImplementation() public view returns(address) {
    return addressStorage[keccak256(abi.encodePacked("foreignBridgeErcToErcImplementation"))];
  }

  function setForeignBridgeErcToErcImplementation(address _foreignBridgeErcToErcImplementation) public onlyOwner {
    addressStorage[keccak256(abi.encodePacked("foreignBridgeErcToErcImplementation"))] = _foreignBridgeErcToErcImplementation;
  }

  function requiredBlockConfirmations() public view returns(uint256) {
    return uintStorage[keccak256(abi.encodePacked("requiredBlockConfirmations"))];
  }

  function setRequiredBlockConfirmations(uint256 _requiredBlockConfirmations) public onlyOwner {
    uintStorage[keccak256(abi.encodePacked("requiredBlockConfirmations"))] = _requiredBlockConfirmations;
  }

  function gasPrice() public view returns(uint256) {
    return uintStorage[keccak256(abi.encodePacked("gasPrice"))];
  }

  function setGasPrice(uint256 _gasPrice) public onlyOwner {
    uintStorage[keccak256(abi.encodePacked("gasPrice"))] = _gasPrice;
  }
  
  function foreignMaxPerTx() public view returns(uint256) {
    return uintStorage[keccak256(abi.encodePacked("foreignMaxPerTx"))];
  }

  function setForeignMaxPerTx(uint256 _foreignMaxPerTx) public onlyOwner {
    uintStorage[keccak256(abi.encodePacked("foreignMaxPerTx"))] = _foreignMaxPerTx;
  }

  function homeDailyLimit() public view returns(uint256) {
    return uintStorage[keccak256(abi.encodePacked("homeDailyLimit"))];
  }

  function setHomeDailyLimit(uint256 _homeDailyLimit) public onlyOwner {
    uintStorage[keccak256(abi.encodePacked("homeDailyLimit"))] = _homeDailyLimit;
  }

  function homeMaxPerTx() public view returns(uint256) {
    return uintStorage[keccak256(abi.encodePacked("homeMaxPerTx"))];
  }

  function setHomeMaxPerTx(uint256 _homeMaxPerTx) public onlyOwner {
    uintStorage[keccak256(abi.encodePacked("homeMaxPerTx"))] = _homeMaxPerTx;
  }

  function foreignBridgeOwner() public view returns(address) {
    return addressStorage[keccak256(abi.encodePacked("foreignBridgeOwner"))];
  }

  function setForeignBridgeOwner(address _foreignBridgeOwner) public onlyOwner {
    addressStorage[keccak256(abi.encodePacked("foreignBridgeOwner"))] = _foreignBridgeOwner;
  }

  function foreignBridgeProxyOwner() public view returns(address) {
    return addressStorage[keccak256(abi.encodePacked("foreignBridgeProxyOwner"))];
  }

  function setForeignBridgeProxyOwner(address _foreignBridgeProxyOwner) public onlyOwner {
    addressStorage[keccak256(abi.encodePacked("foreignBridgeProxyOwner"))] = _foreignBridgeProxyOwner;
  }
}