pragma solidity 0.4.24;

import "../BasicForeignBridge.sol";
import "../ERC20Bridge.sol";
import "../OtherSideBridgeStorage.sol";
import "../../interfaces/IScdMcdMigration.sol";

contract ForeignBridgeErcToNative is BasicForeignBridge, ERC20Bridge, OtherSideBridgeStorage {
    event TokensSwapped(address indexed from, address indexed to, uint256 value);

    function initialize(
        address _validatorContract,
        address _erc20token,
        uint256 _requiredBlockConfirmations,
        uint256 _gasPrice,
        uint256[] _requestLimitsArray, // [ 0 = _dailyLimit, 1 = _maxPerTx, 2 = _minPerTx ]
        uint256[] _executionLimitsArray, // [ 0 = _homeDailyLimit, 1 = _homeMaxPerTx, 2 = _homeMinPerTx ]
        address _owner,
        uint256 _decimalShift,
        address _bridgeOnOtherSide,
        address _limitsContract
    ) external returns (bool) {
        require(AddressUtils.isContract(_limitsContract));
        addressStorage[LIMITS_CONTRACT] = _limitsContract;
        _setLimits(_requestLimitsArray, _executionLimitsArray);
        return
            _initialize(
                _validatorContract,
                _erc20token,
                _requiredBlockConfirmations,
                _gasPrice,
                _owner,
                _decimalShift,
                _bridgeOnOtherSide
            );
    }

    function _initialize(
        address _validatorContract,
        address _erc20token,
        uint256 _requiredBlockConfirmations,
        uint256 _gasPrice,
        address _owner,
        uint256 _decimalShift,
        address _bridgeOnOtherSide
    ) internal returns (bool) {
        require(!isInitialized());
        require(AddressUtils.isContract(_validatorContract));
        require(_requiredBlockConfirmations != 0);
        require(_gasPrice > 0);
        require(_owner != address(0));
        require(_bridgeOnOtherSide != address(0));

        addressStorage[VALIDATOR_CONTRACT] = _validatorContract;
        setErc20token(_erc20token);
        uintStorage[DEPLOYED_AT_BLOCK] = block.number;
        uintStorage[REQUIRED_BLOCK_CONFIRMATIONS] = _requiredBlockConfirmations;
        uintStorage[GAS_PRICE] = _gasPrice;
        uintStorage[DECIMAL_SHIFT] = _decimalShift;
        setOwner(_owner);
        _setBridgeContractOnOtherSide(_bridgeOnOtherSide);
        setInitialize();

        emit RequiredBlockConfirmationChanged(_requiredBlockConfirmations);
        emit GasPriceChanged(_gasPrice);

        return isInitialized();
    }

    function getBridgeMode() external pure returns (bytes4 _data) {
        return 0x18762d46; // bytes4(keccak256(abi.encodePacked("erc-to-native-core")))
    }

    function claimTokens(address _token, address _to) public {
        require(_token != address(erc20token()));
        super.claimTokens(_token, _to);
    }

    function onExecuteMessage(
        address _recipient,
        uint256 _amount,
        bytes32 /*_txHash*/
    ) internal returns (bool) {
        _increaseTotalExecutedPerDay(_amount);
        uint256 amount = _amount.div(10**decimalShift());
        return erc20token().transfer(_recipient, amount);
    }

    function onFailedMessage(address, uint256, bytes32) internal {
        revert();
    }

    function _relayTokens(address _sender, address _receiver, uint256 _amount) internal {
        require(_receiver != bridgeContractOnOtherSide());
        super._relayTokens(_sender, _receiver, _amount);
    }

    function migrateToMCD(address _migrationContract) external onlyOwner {
        bytes32 storageAddress = 0x3378953eb16363e06fd9ea9701d36ed7285d206d9de7df55b778462d74596a89; // keccak256(abi.encodePacked("migrationToMcdCompleted"))

        require(!boolStorage[storageAddress]);
        require(AddressUtils.isContract(_migrationContract));

        uint256 curBalance = erc20token().balanceOf(address(this));
        require(erc20token().approve(_migrationContract, curBalance));
        //It is important to note that this action will cause appearing of `Transfer`
        //event as part of the tokens minting
        IScdMcdMigration(_migrationContract).swapSaiToDai(curBalance);
        address saiContract = erc20token();
        address mcdContract = IDaiAdapter(IScdMcdMigration(_migrationContract).daiJoin()).dai();
        setErc20token(mcdContract);
        require(erc20token().balanceOf(address(this)) == curBalance);

        emit TokensSwapped(saiContract, erc20token(), curBalance);
        boolStorage[storageAddress] = true;
    }
}
