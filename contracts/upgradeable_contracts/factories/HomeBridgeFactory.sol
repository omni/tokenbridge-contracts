pragma solidity 0.4.24;

import "../../IBridgeValidators.sol";
import "../../IHomeBridge.sol";
import "../../upgradeability/EternalStorageProxy.sol";
import "../../upgradeability/EternalStorage.sol";
import "../../ERC677BridgeToken.sol";
import "../EternalOwnable.sol";

contract HomeBridgeFactory is EternalStorage, EternalOwnable {

  event HomeBridgeDeployed(address indexed _homeBridge, address indexed _homeValidators, address indexed _token, uint256 _blockNumber);

  function getBridgeFactoryVersion() public pure returns(uint64 major, uint64 minor, uint64 patch) {
    return (2, 2, 0);
  }

  function initialize(address _owner,
      address _bridgeValidatorsImplementation,
      uint256 _requiredSignatures,
      address[] _initialValidators,
      address _bridgeValidatorsOwner,
      address _homeBridgeErcToErcImplementation,
      uint256 _requiredBlockConfirmations,
      uint256 _gasPrice,
      uint256 _dailyLimit,
      uint256 _maxPerTx,
      uint256 _minPerTx,
      uint256 _foreignDailyLimit,
      uint256 _foreignMaxPerTx,
      address _homeBridgeOwner,
      address _homeProxyOwner) public {
    

    require(_owner != address(0));
    require(_bridgeValidatorsImplementation != address(0));
    require(_requiredSignatures >= 1);
    require(_bridgeValidatorsOwner != address(0));
    require(_homeBridgeErcToErcImplementation != address(0));
    require(_gasPrice > 0);
    require(_requiredBlockConfirmations > 0);
    require(_minPerTx > 0 && _maxPerTx > _minPerTx && _dailyLimit > _maxPerTx);
    require(_foreignMaxPerTx < _foreignDailyLimit);
    require(_homeBridgeOwner != address(0));
    require(_homeProxyOwner != address(0));

    setOwner(_owner);
    setBridgeValidatorsImplementation(_bridgeValidatorsImplementation);
    setRequiredSignatures(_requiredSignatures);
    setInitialValidators(_initialValidators);
    setBridgeValidatorsOwner(_bridgeValidatorsOwner);
    setBridgeValidatorsProxyOwner(_homeProxyOwner);
    setHomeBridgeErcToErcImplementation(_homeBridgeErcToErcImplementation);
    setRequiredBlockConfirmations(_requiredBlockConfirmations);
    setGasPrice(_gasPrice);
    setDailyLimit(_dailyLimit);
    setMaxPerTx(_maxPerTx);
    setMinPerTx(_minPerTx);
    setForeignDailyLimit(_foreignDailyLimit);
    setForeignMaxPerTx(_foreignMaxPerTx);
    setHomeBridgeOwner(_homeBridgeOwner);
    setHomeBridgeProxyOwner(_homeProxyOwner);
  }

  function deployHomeBridge(string _tokenName, string _tokenSymbol, uint8 _tokenDecimals) public onlyOwner {
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
    // connect it to the static homeBridgeErcToErc implementation
    proxy.upgradeTo(1, homeBridgeErcToErcImplementation());
    // deploy erc677 token bridge token
    ERC677BridgeToken token = new ERC677BridgeToken(_tokenName, _tokenSymbol, _tokenDecimals);
    // set token bridge contract
    token.setBridgeContract(proxy);
    // transger token ownership to the bridge
    token.transferOwnership(proxy);
    // cast proxy as IHomeBridge
    IHomeBridge homeBridge = IHomeBridge(proxy);
    // initialize homeBridge
    homeBridge.initialize(bridgeValidators, dailyLimit(), maxPerTx(), minPerTx(), gasPrice(), requiredBlockConfirmations(), token, foreignDailyLimit(), foreignMaxPerTx(), homeBridgeOwner());
    // transger proxy upgradeability admin
    proxy.transferProxyOwnership(homeBridgeProxyOwner());
    // emit event
    emit HomeBridgeDeployed(homeBridge, bridgeValidators, token, block.number);
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

  function homeBridgeErcToErcImplementation() public view returns(address) {
    return addressStorage[keccak256(abi.encodePacked("homeBridgeErcToErcImplementation"))];
  }

  function setHomeBridgeErcToErcImplementation(address _homeBridgeErcToErcImplementation) public onlyOwner {
    addressStorage[keccak256(abi.encodePacked("homeBridgeErcToErcImplementation"))] = _homeBridgeErcToErcImplementation;
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

  function dailyLimit() public view returns(uint256) {
    return uintStorage[keccak256(abi.encodePacked("dailyLimit"))];
  }

  function setDailyLimit(uint256 _dailyLimit) public onlyOwner {
    uintStorage[keccak256(abi.encodePacked("dailyLimit"))] = _dailyLimit;
  }

  function maxPerTx() public view returns(uint256) {
    return uintStorage[keccak256(abi.encodePacked("maxPerTx"))];
  }

  function setMaxPerTx(uint256 _maxPerTx) public onlyOwner {
    uintStorage[keccak256(abi.encodePacked("maxPerTx"))] = _maxPerTx;
  }

  function minPerTx() public view returns(uint256) {
    return uintStorage[keccak256(abi.encodePacked("minPerTx"))];
  }

  function setMinPerTx(uint256 _minPerTx) public onlyOwner {
    uintStorage[keccak256(abi.encodePacked("minPerTx"))] = _minPerTx;
  }

  function foreignDailyLimit() public view returns(uint256) {
    return uintStorage[keccak256(abi.encodePacked("foreignDailyLimit"))];
  }

  function setForeignDailyLimit(uint256 _foreignDailyLimit) public onlyOwner {
    uintStorage[keccak256(abi.encodePacked("foreignDailyLimit"))] = _foreignDailyLimit;
  }

  function foreignMaxPerTx() public view returns(uint256) {
    return uintStorage[keccak256(abi.encodePacked("foreignMaxPerTx"))];
  }

  function setForeignMaxPerTx(uint256 _foreignMaxPerTx) public onlyOwner {
    uintStorage[keccak256(abi.encodePacked("foreignMaxPerTx"))] = _foreignMaxPerTx;
  }

  function homeBridgeOwner() public view returns(address) {
    return addressStorage[keccak256(abi.encodePacked("homeBridgeOwner"))];
  }

  function setHomeBridgeOwner(address _homeBridgeOwner) public onlyOwner {
    addressStorage[keccak256(abi.encodePacked("homeBridgeOwner"))] = _homeBridgeOwner;
  }

  function homeBridgeProxyOwner() public view returns(address) {
    return addressStorage[keccak256(abi.encodePacked("homeBridgeProxyOwner"))];
  }

  function setHomeBridgeProxyOwner(address _homeBridgeProxyOwner) public onlyOwner {
    addressStorage[keccak256(abi.encodePacked("homeBridgeProxyOwner"))] = _homeBridgeProxyOwner;
  }
}