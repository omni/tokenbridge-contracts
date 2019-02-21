pragma solidity 0.4.24;

import "../../IBridgeValidators.sol";
import "../../IHomeBridge.sol";
import "../../upgradeability/EternalStorageProxy.sol";
import "../../ERC677BridgeToken.sol";
import "./BasicBridgeFactory.sol";

contract HomeBridgeFactory is BasicBridgeFactory {

    event HomeBridgeDeployed(address indexed _homeBridge, address indexed _homeValidators, address indexed _token, uint256 _blockNumber);

    function initialize(address _owner,
            address _bridgeValidatorsImplementation,
            uint256 _requiredSignatures,
            address[] _initialValidators,
            address _bridgeValidatorsOwner,
            address _homeBridgeErcToErcImplementation,
            uint256 _requiredBlockConfirmations,
            uint256 _gasPrice,
            uint256 _homeDailyLimit,
            uint256 _homeMaxPerTx,
            uint256 _minPerTx,
            uint256 _foreignDailyLimit,
            uint256 _foreignMaxPerTx,
            address _homeBridgeOwner,
            address _homeProxyOwner) public {
        

        require(!isInitialized());
        require(_owner != address(0));
        require(_bridgeValidatorsImplementation != address(0));
        require(_requiredSignatures >= 1);
        require(_bridgeValidatorsOwner != address(0));
        require(_homeBridgeErcToErcImplementation != address(0));
        require(_gasPrice > 0);
        require(_requiredBlockConfirmations > 0);
        require(_minPerTx > 0 && _homeMaxPerTx > _minPerTx && _homeDailyLimit > _homeMaxPerTx);
        require(_foreignMaxPerTx < _foreignDailyLimit);
        require(_homeBridgeOwner != address(0));
        require(_homeProxyOwner != address(0));
        require(_initialValidators.length >= _requiredSignatures);

        setOwner(msg.sender); // set just to have access to the setters.
        setBridgeValidatorsImplementation(_bridgeValidatorsImplementation);
        setInitialValidators(_initialValidators);
        setRequiredSignatures(_requiredSignatures);
        setBridgeValidatorsOwner(_bridgeValidatorsOwner);
        setBridgeValidatorsProxyOwner(_homeProxyOwner);
        setHomeBridgeErcToErcImplementation(_homeBridgeErcToErcImplementation);
        setRequiredBlockConfirmations(_requiredBlockConfirmations);
        setGasPrice(_gasPrice);
        setHomeDailyLimit(_homeDailyLimit);
        setHomeMaxPerTx(_homeMaxPerTx);
        setMinPerTx(_minPerTx);
        setForeignDailyLimit(_foreignDailyLimit);
        setForeignMaxPerTx(_foreignMaxPerTx);
        setHomeBridgeOwner(_homeBridgeOwner);
        setHomeBridgeProxyOwner(_homeProxyOwner);
        setInitialize(true);
        setOwner(_owner); // set to the real owner.
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
        // transfer proxy upgradeability admin
        proxy.transferProxyOwnership(bridgeValidatorsProxyOwner());
        // deploy new EternalStorageProxy
        proxy = new EternalStorageProxy();
        // connect it to the static homeBridgeErcToErc implementation
        proxy.upgradeTo(1, homeBridgeErcToErcImplementation());
        // deploy erc677 token bridge token
        ERC677BridgeToken token = new ERC677BridgeToken(_tokenName, _tokenSymbol, _tokenDecimals);
        // set token bridge contract
        token.setBridgeContract(proxy);
        // transfer token ownership to the bridge
        token.transferOwnership(proxy);
        // cast proxy as IHomeBridge
        IHomeBridge homeBridge = IHomeBridge(proxy);
        // initialize homeBridge
        homeBridge.initialize(bridgeValidators, homeDailyLimit(), homeMaxPerTx(), minPerTx(), gasPrice(), requiredBlockConfirmations(), token, foreignDailyLimit(), foreignMaxPerTx(), homeBridgeOwner());
        // transfer proxy upgradeability admin
        proxy.transferProxyOwnership(homeBridgeProxyOwner());
        // emit event
        emit HomeBridgeDeployed(homeBridge, bridgeValidators, token, block.number);
    }

    function homeBridgeErcToErcImplementation() public view returns(address) {
        return addressStorage[keccak256(abi.encodePacked("homeBridgeErcToErcImplementation"))];
    }

    function setHomeBridgeErcToErcImplementation(address _homeBridgeErcToErcImplementation) public onlyOwner {
        addressStorage[keccak256(abi.encodePacked("homeBridgeErcToErcImplementation"))] = _homeBridgeErcToErcImplementation;
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