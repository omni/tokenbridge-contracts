pragma solidity 0.4.24;

import "../BasicForeignBridge.sol";
import "../ERC20Bridge.sol";
import "../OtherSideBridgeStorage.sol";
import "../../interfaces/IScdMcdMigration.sol";
import "../ChaiConnector.sol";

contract ForeignBridgeErcToNative is BasicForeignBridge, ERC20Bridge, OtherSideBridgeStorage, ChaiConnector {
    event TokensSwapped(address indexed from, address indexed to, uint256 value);

    bytes32 internal constant MIN_HDTOKEN_BALANCE = 0x48649cf195feb695632309f41e61252b09f537943654bde13eb7bb1bca06964e; // keccak256(abi.encodePacked("minHDTokenBalance"))
    bytes4 internal constant SWAP_TOKENS = 0x73d00224; // swapTokens()

    function initialize(
        address _validatorContract,
        address _erc20token,
        uint256 _requiredBlockConfirmations,
        uint256 _gasPrice,
        uint256[] _dailyLimitMaxPerTxMinPerTxArray, // [ 0 = _dailyLimit, 1 = _maxPerTx, 2 = _minPerTx ]
        uint256[] _homeDailyLimitHomeMaxPerTxArray, //[ 0 = _homeDailyLimit, 1 = _homeMaxPerTx ]
        address _owner,
        uint256 _decimalShift,
        address _bridgeOnOtherSide
    ) external onlyRelevantSender returns (bool) {
        require(!isInitialized());
        require(AddressUtils.isContract(_validatorContract));
        require(_requiredBlockConfirmations != 0);
        require(_gasPrice > 0);
        require(
            _dailyLimitMaxPerTxMinPerTxArray[2] > 0 && // _minPerTx > 0
                _dailyLimitMaxPerTxMinPerTxArray[1] > _dailyLimitMaxPerTxMinPerTxArray[2] && // _maxPerTx > _minPerTx
                _dailyLimitMaxPerTxMinPerTxArray[0] > _dailyLimitMaxPerTxMinPerTxArray[1] // _dailyLimit > _maxPerTx
        );
        require(_homeDailyLimitHomeMaxPerTxArray[1] < _homeDailyLimitHomeMaxPerTxArray[0]); // _homeMaxPerTx < _homeDailyLimit
        require(_owner != address(0));
        require(_bridgeOnOtherSide != address(0));

        addressStorage[VALIDATOR_CONTRACT] = _validatorContract;
        setErc20token(_erc20token);
        uintStorage[DEPLOYED_AT_BLOCK] = block.number;
        uintStorage[REQUIRED_BLOCK_CONFIRMATIONS] = _requiredBlockConfirmations;
        uintStorage[GAS_PRICE] = _gasPrice;
        uintStorage[DAILY_LIMIT] = _dailyLimitMaxPerTxMinPerTxArray[0];
        uintStorage[MAX_PER_TX] = _dailyLimitMaxPerTxMinPerTxArray[1];
        uintStorage[MIN_PER_TX] = _dailyLimitMaxPerTxMinPerTxArray[2];
        uintStorage[EXECUTION_DAILY_LIMIT] = _homeDailyLimitHomeMaxPerTxArray[0];
        uintStorage[EXECUTION_MAX_PER_TX] = _homeDailyLimitHomeMaxPerTxArray[1];
        uintStorage[DECIMAL_SHIFT] = _decimalShift;
        setOwner(_owner);
        _setBridgeContractOnOtherSide(_bridgeOnOtherSide);
        setInitialize();

        emit RequiredBlockConfirmationChanged(_requiredBlockConfirmations);
        emit GasPriceChanged(_gasPrice);
        emit DailyLimitChanged(_dailyLimitMaxPerTxMinPerTxArray[0]);
        emit ExecutionDailyLimitChanged(_homeDailyLimitHomeMaxPerTxArray[0]);

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
        setTotalExecutedPerDay(getCurrentDay(), totalExecutedPerDay(getCurrentDay()).add(_amount));
        uint256 amount = _amount.div(10**decimalShift());

        uint256 currentBalance = tokenBalance(erc20token());

        // Convert part of Chai tokens back to DAI, is DAI balance is insufficient.
        // If Chai token is disabled, bridge will keep all funds directly in DAI token,
        // so it will have enough funds to cover any xDai => Dai transfer,
        // and currentBalance >= amount will always hold.
        if (currentBalance < amount) {
            _convertChaiToDai(amount.sub(currentBalance).add(minDaiTokenBalance()));
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

        emit TokensSwapped(hdToken, fdToken, curHDTokenBalance);
    }

    function relayTokens(address _receiver, uint256 _amount) external {
        _relayTokens(msg.sender, _receiver, _amount, erc20token());
    }

    function relayTokens(address _sender, address _receiver, uint256 _amount) external {
        relayTokens(_sender, _receiver, _amount, erc20token());
    }

    function relayTokens(address _from, address _receiver, uint256 _amount, address _token) public {
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
        require(withinLimit(_amount));

        ERC20 tokenToOperate = ERC20(_token);
        ERC20 hdToken = halfDuplexErc20token();
        ERC20 fdToken = erc20token();

        if (tokenToOperate == ERC20(0x0)) {
            tokenToOperate = fdToken;
        }

        require(tokenToOperate == fdToken || tokenToOperate == hdToken);

        setTotalSpentPerDay(getCurrentDay(), totalSpentPerDay(getCurrentDay()).add(_amount));

        tokenToOperate.transferFrom(_sender, address(this), _amount);
        emit UserRequestForAffirmation(_receiver, _amount);

        if (tokenToOperate == hdToken) {
            swapTokens();
        }
        if (isDaiNeedsToBeInvested()) {
            convertDaiToChai();
        }
    }
}
