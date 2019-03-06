pragma solidity 0.4.24;

import "../../IBridgeValidators.sol";
import "../../IForeignBridge.sol";
import "../../upgradeability/EternalStorageProxy.sol";
import "./BasicBridgeFactory.sol";

contract ForeignBridgeFactory is BasicBridgeFactory {

    event ForeignBridgeDeployed(address indexed _foreignBridge, address indexed _foreignValidators, uint256 _blockNumber);

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
            address _foreignProxyOwner) public returns(bool) {

        require(!isInitialized());
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
        require(_initialValidators.length >= _requiredSignatures);

        setOwner(msg.sender); // set just to have access to the setters.
        setBridgeValidatorsImplementation(_bridgeValidatorsImplementation);
        setInitialValidators(_initialValidators);
        setRequiredSignatures(_requiredSignatures);
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
        setInitialize(true);
        setOwner(_owner); // set to the real owner.
        return isInitialized();
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
        // transfer proxy upgradeability admin
        proxy.transferProxyOwnership(bridgeValidatorsProxyOwner());
        // deploy new EternalStorageProxy
        proxy = new EternalStorageProxy();
        // connect it to the static ForeignBridgeErcToErc implementation
        proxy.upgradeTo(1, foreignBridgeErcToErcImplementation());
        // cast proxy as IForeignBridge
        IForeignBridge foreignBridge = IForeignBridge(proxy);
        // initialize foreignBridge
        foreignBridge.initialize(bridgeValidators, _erc20Token, requiredBlockConfirmations(), gasPrice(), foreignMaxPerTx(), homeDailyLimit(), homeMaxPerTx(), foreignBridgeOwner());
        // transfer proxy upgradeability admin
        proxy.transferProxyOwnership(foreignBridgeProxyOwner());
        // emit event
        emit ForeignBridgeDeployed(foreignBridge, bridgeValidators, block.number);
    }

    function foreignBridgeErcToErcImplementation() public view returns(address) {
        return addressStorage[keccak256(abi.encodePacked("foreignBridgeErcToErcImplementation"))];
    }

    function setForeignBridgeErcToErcImplementation(address _foreignBridgeErcToErcImplementation) public onlyOwner {
        addressStorage[keccak256(abi.encodePacked("foreignBridgeErcToErcImplementation"))] = _foreignBridgeErcToErcImplementation;
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