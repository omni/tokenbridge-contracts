pragma solidity 0.4.24;

import "../BasicForeignBridge.sol";
import "../ERC20Bridge.sol";
import "../OtherSideBridgeStorage.sol";
import "./CompoundConnector.sol";

contract ForeignBridgeErcToNative is BasicForeignBridge, ERC20Bridge, OtherSideBridgeStorage, CompoundConnector {
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

        addressStorage[VALIDATOR_CONTRACT] = _validatorContract;
        setErc20token(_erc20token);
        uintStorage[DEPLOYED_AT_BLOCK] = block.number;
        _setRequiredBlockConfirmations(_requiredBlockConfirmations);
        _setGasPrice(_gasPrice);
        _setLimits(_dailyLimitMaxPerTxMinPerTxArray);
        _setExecutionLimits(_homeDailyLimitHomeMaxPerTxArray);
        _setDecimalShift(_decimalShift);
        _setOwner(_owner);
        _setBridgeContractOnOtherSide(_bridgeOnOtherSide);
        setInitialize();

        return isInitialized();
    }

    function getBridgeMode() external pure returns (bytes4 _data) {
        return 0x18762d46; // bytes4(keccak256(abi.encodePacked("erc-to-native-core")))
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
        address bridgedToken = address(erc20token());
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
        uint256 amount = _unshiftValue(_amount);

        ERC20 token = erc20token();
        uint256 currentBalance = token.balanceOf(address(this));

        if (currentBalance < amount) {
            uint256 withdrawAmount = (amount - currentBalance).add(minCashThreshold(address(token)));
            _withdraw(address(token), withdrawAmount);
        }

        return token.transfer(_recipient, amount);
    }

    function onFailedMessage(address, uint256, bytes32) internal {
        revert();
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
    }
}
