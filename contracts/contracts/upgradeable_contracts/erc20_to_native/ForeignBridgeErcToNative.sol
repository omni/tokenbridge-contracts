pragma solidity 0.4.24;

import "../BasicForeignBridge.sol";
import "../ERC20Bridge.sol";
import "../OtherSideBridgeStorage.sol";
import "../ChaiConnector.sol";

contract ForeignBridgeErcToNative is BasicForeignBridge, ERC20Bridge, OtherSideBridgeStorage, ChaiConnector {
    function initialize(
        address _validatorContract,
        address _erc20token,
        uint256 _requiredBlockConfirmations,
        uint256 _gasPrice,
        uint256[3] _dailyLimitMaxPerTxMinPerTxArray, // [ 0 = _dailyLimit, 1 = _maxPerTx, 2 = _minPerTx ]
        uint256[2] _homeDailyLimitHomeMaxPerTxArray, //[ 0 = _homeDailyLimit, 1 = _homeMaxPerTx ]
        address _owner,
        int256 _decimalShift,
        address _bridgeOnOtherSide
    ) external onlyRelevantSender returns (bool) {
        require(!isInitialized());
        require(AddressUtils.isContract(_validatorContract));
        require(_owner != address(0));
        require(_bridgeOnOtherSide != address(0));

        addressStorage[VALIDATOR_CONTRACT] = _validatorContract;
        setErc20token(_erc20token);
        uintStorage[DEPLOYED_AT_BLOCK] = block.number;
        _setRequiredBlockConfirmations(_requiredBlockConfirmations);
        _setGasPrice(_gasPrice);
        _setLimits(_dailyLimitMaxPerTxMinPerTxArray);
        _setExecutionLimits(_homeDailyLimitHomeMaxPerTxArray);
        _setDecimalShift(_decimalShift);
        setOwner(_owner);
        _setBridgeContractOnOtherSide(_bridgeOnOtherSide);
        setInitialize();

        return isInitialized();
    }

    function getBridgeMode() external pure returns (bytes4 _data) {
        return 0x18762d46; // bytes4(keccak256(abi.encodePacked("erc-to-native-core")))
    }

    function claimTokens(address _token, address _to) public {
        require(_token != address(erc20token()));
        // Chai token is not claimable if investing into Chai is enabled
        require(_token != address(chaiToken()) || !isChaiTokenEnabled());
        super.claimTokens(_token, _to);
    }

    function onExecuteMessage(
        address _recipient,
        uint256 _amount,
        bytes32 /*_txHash*/
    ) internal returns (bool) {
        addTotalExecutedPerDay(getCurrentDay(), _amount);
        uint256 amount = _unshiftValue(_amount);

        uint256 currentBalance = tokenBalance(erc20token());

        // Convert part of Chai tokens back to DAI, if DAI balance is insufficient.
        // If Chai token is disabled, bridge will keep all funds directly in DAI token,
        // so it will have enough funds to cover any xDai => Dai transfer,
        // and currentBalance >= amount will always hold.
        if (currentBalance < amount) {
            _convertChaiToDai(amount.sub(currentBalance).add(minDaiTokenBalance()));
        }

        bool res = erc20token().transfer(_recipient, amount);

        return res;
    }

    function onFailedMessage(
        address,
        uint256,
        bytes32
    ) internal {
        revert();
    }

    function tokenBalance(ERC20 _token) internal view returns (uint256) {
        return _token.balanceOf(address(this));
    }

    function relayTokens(address _receiver, uint256 _amount) external {
        require(_receiver != bridgeContractOnOtherSide());
        require(_receiver != address(0));
        require(_receiver != address(this));
        require(_amount > 0);
        require(withinLimit(_amount));

        addTotalSpentPerDay(getCurrentDay(), _amount);

        erc20token().transferFrom(msg.sender, address(this), _amount);
        emit UserRequestForAffirmation(_receiver, _amount);

        if (isDaiNeedsToBeInvested()) {
            convertDaiToChai();
        }
    }
}
