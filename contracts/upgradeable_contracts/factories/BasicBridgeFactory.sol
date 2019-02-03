pragma solidity 0.4.24;

import "../../upgradeability/EternalStorage.sol";
import "../EternalOwnable.sol";

contract BasicBridgeFactory is EternalStorage, EternalOwnable {

    function getBridgeFactoryVersion() public pure returns(uint64 major, uint64 minor, uint64 patch) {
        return (2, 2, 0);
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
        require(initialValidators().length >= _requiredSignatures);
        uintStorage[keccak256(abi.encodePacked("requiredSignatures"))] = _requiredSignatures;
    }

    function initialValidators() public view returns(address[]) {
        return addressArrayStorage[keccak256(abi.encodePacked("initialValidators"))];
    }

    function setInitialValidators(address[] _initialValidators) public onlyOwner {
        require(_initialValidators.length >= requiredSignatures());
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

    function foreignMaxPerTx() public view returns(uint256) {
        return uintStorage[keccak256(abi.encodePacked("foreignMaxPerTx"))];
    }

    function setForeignMaxPerTx(uint256 _foreignMaxPerTx) public onlyOwner {
        uintStorage[keccak256(abi.encodePacked("foreignMaxPerTx"))] = _foreignMaxPerTx;
    }

    function setInitialize(bool _status) internal { 
        boolStorage[keccak256(abi.encodePacked("isInitialized"))] = _status; 
    }

    function isInitialized() public view returns(bool) { 
        return boolStorage[keccak256(abi.encodePacked("isInitialized"))]; 
    }
}