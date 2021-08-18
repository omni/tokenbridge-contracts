pragma solidity 0.4.24;

import "./ForeignBridgeErcToNative.sol";
import "./CompoundConnector.sol";
import "../GSNForeignERC20Bridge.sol";

contract XDaiForeignBridge is ForeignBridgeErcToNative, CompoundConnector, GSNForeignERC20Bridge {
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
        require(_erc20token == address(daiToken()));
        require(_decimalShift == 0);

        addressStorage[VALIDATOR_CONTRACT] = _validatorContract;
        uintStorage[DEPLOYED_AT_BLOCK] = block.number;
        _setRequiredBlockConfirmations(_requiredBlockConfirmations);
        _setGasPrice(_gasPrice);
        _setLimits(_dailyLimitMaxPerTxMinPerTxArray);
        _setExecutionLimits(_homeDailyLimitHomeMaxPerTxArray);
        _setOwner(_owner);
        _setBridgeContractOnOtherSide(_bridgeOnOtherSide);
        setInitialize();

        return isInitialized();
    }

    function erc20token() public view returns (ERC20) {
        return daiToken();
    }

    function upgradeTo530(address _interestReceiver) external {
        require(msg.sender == address(this));

        address dai = address(daiToken());
        address comp = address(compToken());
        _setInterestEnabled(dai, true);
        _setMinCashThreshold(dai, 1000000 ether);
        _setMinInterestPaid(dai, 1000 ether);
        _setInterestReceiver(dai, _interestReceiver);

        _setMinInterestPaid(comp, 1 ether);
        _setInterestReceiver(comp, _interestReceiver);

        invest(dai);
    }

    function investDai() external {
        invest(address(daiToken()));
    }

    /**
     * @dev Withdraws the erc20 tokens or native coins from this contract.
     * @param _token address of the claimed token or address(0) for native coins.
     * @param _to address of the tokens/coins receiver.
     */
    function claimTokens(address _token, address _to) external onlyIfUpgradeabilityOwner {
        // Since bridged tokens are locked at this contract, it is not allowed to claim them with the use of claimTokens function
        address bridgedToken = address(daiToken());
        require(_token != address(bridgedToken));
        require(_token != address(cDaiToken()) || !isInterestEnabled(bridgedToken));
        require(_token != address(compToken()) || !isInterestEnabled(bridgedToken));
        claimValues(_token, _to);
    }

    function onExecuteMessage(
        address _recipient,
        uint256 _amount,
        bytes32 /*_txHash*/
    ) internal returns (bool) {
        addTotalExecutedPerDay(getCurrentDay(), _amount);

        ERC20 token = daiToken();
        ensureEnoughTokens(token, _amount);

        return token.transfer(_recipient, _amount);
    }

    function onExecuteMessageGSN(address recipient, uint256 amount, uint256 fee) internal returns (bool) {
        ensureEnoughTokens(daiToken(), amount);

        return super.onExecuteMessageGSN(recipient, amount, fee);
    }

    function ensureEnoughTokens(ERC20 token, uint256 amount) internal {
        uint256 currentBalance = token.balanceOf(address(this));

        if (currentBalance < amount) {
            uint256 withdrawAmount = (amount - currentBalance).add(minCashThreshold(address(token)));
            _withdraw(address(token), withdrawAmount);
        }
    }
}
