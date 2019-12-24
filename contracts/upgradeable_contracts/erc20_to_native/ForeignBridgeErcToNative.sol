pragma solidity 0.4.24;

import "../BasicForeignBridge.sol";
import "../ERC20Bridge.sol";
import "../OtherSideBridgeStorage.sol";
import "../../interfaces/IScdMcdMigration.sol";
import "../RTokenConnector.sol";

contract ForeignBridgeErcToNative is BasicForeignBridge, ERC20Bridge, OtherSideBridgeStorage, RTokenConnector {
    event TokensSwapped(address indexed from, address indexed to, uint256 value);

    bytes32 internal constant MIN_HDTOKEN_BALANCE = 0x48649cf195feb695632309f41e61252b09f537943654bde13eb7bb1bca06964e; // keccak256(abi.encodePacked("minHDTokenBalance"))
    bytes4 internal constant SWAP_TOKENS = 0x73d00224; // swapTokens()

    function initialize(
        address _validatorContract,
        address _erc20token,
        uint256 _requiredBlockConfirmations,
        uint256 _gasPrice,
        // [ 0 = _dailyLimit, 1 = _maxPerTx, 2 = _minPerTx ]
        uint256[] _requestLimitsArray,
        // absolute: [ 0 = _executionDailyLimit, 1 = _executionMaxPerTx, 2 = _executionMinPerTx ]
        // relative: [ 0 = _targetLimit, 1 = _threshold, 2 = _executionMaxPerTx, 3 = _executionMinPerTx ]
        uint256[] _executionLimitsArray,
        address _owner,
        uint256 _decimalShift,
        address _bridgeOnOtherSide,
        address _limitsContract
    ) external returns (bool) {
        require(!isInitialized());
        require(AddressUtils.isContract(_validatorContract));
        require(_requiredBlockConfirmations != 0);
        require(_gasPrice > 0);
        require(_owner != address(0));
        require(_bridgeOnOtherSide != address(0));
        require(AddressUtils.isContract(_limitsContract));

        addressStorage[VALIDATOR_CONTRACT] = _validatorContract;
        setErc20token(_erc20token);
        uintStorage[DEPLOYED_AT_BLOCK] = block.number;
        uintStorage[REQUIRED_BLOCK_CONFIRMATIONS] = _requiredBlockConfirmations;
        uintStorage[GAS_PRICE] = _gasPrice;
        uintStorage[DECIMAL_SHIFT] = _decimalShift;
        setOwner(_owner);
        _setBridgeContractOnOtherSide(_bridgeOnOtherSide);
        addressStorage[LIMITS_CONTRACT] = _limitsContract;
        _setLimits(_requestLimitsArray, _executionLimitsArray);

        emit RequiredBlockConfirmationChanged(_requiredBlockConfirmations);
        emit GasPriceChanged(_gasPrice);

        setInitialize();
        return isInitialized();
    }

    function getBridgeMode() external pure returns (bytes4 _data) {
        return 0x18762d46; // bytes4(keccak256(abi.encodePacked("erc-to-native-core")))
    }

    function claimTokens(address _token, address _to) public {
        require(_token != address(erc20token()));
        if (_token == address(halfDuplexErc20token())) {
            // SCD is not claimable if the bridge accepts deposits of this token
            // solhint-disable-next-line not-rely-on-time
            require(!isTokenSwapAllowed(now));
        }
        super.claimTokens(_token, _to);
    }

    function onExecuteMessage(
        address _recipient,
        uint256 _amount,
        bytes32 /*_txHash*/
    ) internal returns (bool) {
        _increaseTotalExecutedPerDay(_amount);
        uint256 amount = _amount.div(10**decimalShift());

        uint256 currentBalance = _getTokenBalance();
        if (currentBalance < amount) {
            _redeemRToken(amount.sub(currentBalance));
        }

        bool res = erc20token().transfer(_recipient, amount);

        if (tokenBalance(halfDuplexErc20token()) > 0) {
            address(this).call(abi.encodeWithSelector(SWAP_TOKENS));
        }

        return res;
    }

    function onFailedMessage(address, uint256, bytes32) internal {
        revert();
    }

    function migrateToMCD() external {
        bytes32 storageAddress = 0x3378953eb16363e06fd9ea9701d36ed7285d206d9de7df55b778462d74596a89; // keccak256(abi.encodePacked("migrationToMcdCompleted"))
        require(!boolStorage[storageAddress]);

        address mcdContract = IDaiAdapter(migrationContract().daiJoin()).dai();
        setErc20token(mcdContract);

        uintStorage[MIN_HDTOKEN_BALANCE] = 10 ether;

        swapTokens();

        boolStorage[storageAddress] = true;
    }

    function saiTopContract() internal pure returns (ISaiTop) {
        return ISaiTop(0x9b0ccf7C8994E19F39b2B4CF708e0A7DF65fA8a3);
    }

    function isTokenSwapAllowed(uint256 _ts) public view returns (bool) {
        uint256 esTs = saiTopContract().caged();
        if (esTs > 0 && _ts > esTs) {
            return false;
        }
        return true;
    }

    function halfDuplexErc20token() public pure returns (ERC20) {
        return ERC20(0x89d24A6b4CcB1B6fAA2625fE562bDD9a23260359);
    }

    function setMinHDTokenBalance(uint256 _minBalance) external onlyOwner {
        uintStorage[MIN_HDTOKEN_BALANCE] = _minBalance;
    }

    function minHDTokenBalance() public view returns (uint256) {
        return uintStorage[MIN_HDTOKEN_BALANCE];
    }

    function isHDTokenBalanceAboveMinBalance() public view returns (bool) {
        if (tokenBalance(halfDuplexErc20token()) > minHDTokenBalance()) {
            return true;
        }
        return false;
    }

    function tokenBalance(ERC20 _token) internal view returns (uint256) {
        return _token.balanceOf(address(this));
    }

    function migrationContract() internal pure returns (IScdMcdMigration) {
        return IScdMcdMigration(0xc73e0383F3Aff3215E6f04B0331D58CeCf0Ab849);
    }

    function swapTokens() public {
        // solhint-disable-next-line not-rely-on-time
        require(isTokenSwapAllowed(now));

        IScdMcdMigration mcdMigrationContract = migrationContract();
        ERC20 hdToken = halfDuplexErc20token();
        ERC20 fdToken = erc20token();

        uint256 curHDTokenBalance = tokenBalance(hdToken);
        require(curHDTokenBalance > 0);

        uint256 curFDTokenBalance = tokenBalance(fdToken);

        require(hdToken.approve(mcdMigrationContract, curHDTokenBalance));
        mcdMigrationContract.swapSaiToDai(curHDTokenBalance);

        require(tokenBalance(fdToken).sub(curFDTokenBalance) == curHDTokenBalance);

        mintRToken(_getTokenBalance());

        emit TokensSwapped(hdToken, fdToken, curHDTokenBalance);
    }

    function relayTokens(address _from, address _receiver, uint256 _amount, address _token) external {
        require(_from == msg.sender || _from == _receiver);
        _relayTokens(_from, _receiver, _amount, _token);
    }

    function relayTokens(address _receiver, uint256 _amount, address _token) external {
        _relayTokens(msg.sender, _receiver, _amount, _token);
    }

    function _relayTokens(address _sender, address _receiver, uint256 _amount, address _token) internal {
        require(_receiver != bridgeContractOnOtherSide());
        require(_receiver != address(0));
        require(_receiver != address(this));
        require(_amount > 0);
        _updateTodayLimit();
        require(withinLimit(_amount));

        ERC20 tokenToOperate = ERC20(_token);
        ERC20 hdToken = halfDuplexErc20token();
        ERC20 fdToken = erc20token();

        if (tokenToOperate == ERC20(0x0)) {
            tokenToOperate = fdToken;
        }

        require(tokenToOperate == fdToken || tokenToOperate == hdToken);

        _increaseTotalSpentPerDay(_amount);

        tokenToOperate.transferFrom(_sender, address(this), _amount);
        emit UserRequestForAffirmation(_receiver, _amount);

        mintRToken(_getTokenBalance());

        if (tokenToOperate == hdToken) {
            swapTokens();
        }
    }

    function _getTokenBalance() internal view returns (uint256) {
        return erc20token().balanceOf(address(this));
    }
}
