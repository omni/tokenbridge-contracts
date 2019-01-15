pragma solidity 0.4.24;

import "../../IBridgeValidators.sol";
import "../../IHomeBridge.sol";
import "../../upgradeability/EternalStorageProxy.sol";
import "../../upgradeability/EternalStorage.sol";
import "../../ERC677BridgeToken.sol";
import "../EternalOwnable.sol";

contract HomeBridgeFactory is EternalStorage, EternalOwnable {

  function initialize(address _owner,
      address _bridgeValidatorsImplementation,
      uint256 _requiredSignatures,
      address[] _initialValidators,
      address _bridgeValidatorsOwner,
      address _bridgeValidatorsProxyOwner,
      address _homeBridgeErcToErcImplementation,
      uint256 _requiredBlockConfirmations,
      uint256 _gasPrice,
      uint256 _dailyLimit,
      uint256 _maxPerTx,
      uint256 _minPerTx,
      address _homeBridgeProxyOwner) public {
    
    require(_owner != address(0));
    require(_bridgeValidatorsImplementation != address(0));
    require(_requiredSignatures >= 1);
    require(_bridgeValidatorsOwner != address(0));
    require(_bridgeValidatorsProxyOwner != address(0));
    require(_homeBridgeErcToErcImplementation != address(0));
    require(_requiredBlockConfirmations > 0);
    require(_dailyLimit > 0);
    require(_maxPerTx > 0);
    require(_minPerTx > 0);
    require(_homeBridgeProxyOwner != address(0));

    setOwner(_owner);
    setBridgeValidatorsImplementation(_bridgeValidatorsImplementation);
    setRequiredSignatures(_requiredSignatures);
    setInitialValidators(_initialValidators);
    setBridgeValidatorsOwner(_bridgeValidatorsOwner);
    setBridgeValidatorsProxyOwner(_bridgeValidatorsProxyOwner);
    setHomeBridgeErcToErcImplementation(_homeBridgeErcToErcImplementation);
    setRequiredBlockConfirmations(_requiredBlockConfirmations);
    setGasPrice(_gasPrice);
    setDailyLimit(_dailyLimit);
    setMaxPerTx(_maxPerTx);
    setMinPerTx(_minPerTx);
    setHomeBridgeProxyOwner(_homeBridgeProxyOwner);
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
    homeBridge.initialize(bridgeValidators, dailyLimit(), maxPerTx(), minPerTx(), gasPrice(), requiredBlockConfirmations(), token);
    // transger proxy upgradeability admin
    proxy.transferProxyOwnership(homeBridgeProxyOwner());
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



  function homeBridgeProxyOwner() public view returns(address) {
    return addressStorage[keccak256(abi.encodePacked("homeBridgeProxyOwner"))];
  }

  function setHomeBridgeProxyOwner(address _homeBridgeProxyOwner) public onlyOwner {
    addressStorage[keccak256(abi.encodePacked("homeBridgeProxyOwner"))] = _homeBridgeProxyOwner;
  }
}