pragma solidity 0.4.24;

import "../BasicForeignBridge.sol";
import "../ERC20Bridge.sol";

contract ForeignBridgeErcToNative is BasicForeignBridge, ERC20Bridge {
    event RelayedMessage(address recipient, uint256 value, bytes32 transactionHash);

    function initialize(
        address _validatorContract,
        address _erc20token,
        uint256 _requiredBlockConfirmations,
        uint256 _gasPrice,
        uint256[] _maxPerTxHomeDailyLimitHomeMaxPerTxArray, //[ 0 = _maxPerTx, 1 = _homeDailyLimit, 2 = _homeMaxPerTx ]
        address _owner,
        uint256 _decimalShift
    ) external returns (bool) {
        require(!isInitialized());
        require(AddressUtils.isContract(_validatorContract));
        require(_requiredBlockConfirmations != 0);
        require(_gasPrice > 0);
        require(_maxPerTxHomeDailyLimitHomeMaxPerTxArray[2] < _maxPerTxHomeDailyLimitHomeMaxPerTxArray[1]); // _homeMaxPerTx < _homeDailyLimit
        require(_owner != address(0));

        addressStorage[VALIDATOR_CONTRACT] = _validatorContract;
        setErc20token(_erc20token);
        uintStorage[DEPLOYED_AT_BLOCK] = block.number;
        uintStorage[REQUIRED_BLOCK_CONFIRMATIONS] = _requiredBlockConfirmations;
        uintStorage[GAS_PRICE] = _gasPrice;
        uintStorage[MAX_PER_TX] = _maxPerTxHomeDailyLimitHomeMaxPerTxArray[0];
        uintStorage[EXECUTION_DAILY_LIMIT] = _maxPerTxHomeDailyLimitHomeMaxPerTxArray[1];
        uintStorage[EXECUTION_MAX_PER_TX] = _maxPerTxHomeDailyLimitHomeMaxPerTxArray[2];
        uintStorage[DECIMAL_SHIFT] = _decimalShift;
        setOwner(_owner);
        setInitialize();

        emit RequiredBlockConfirmationChanged(_requiredBlockConfirmations);
        emit GasPriceChanged(_gasPrice);
        emit ExecutionDailyLimitChanged(_maxPerTxHomeDailyLimitHomeMaxPerTxArray[1]);

        return isInitialized();
    }

    function getBridgeMode() external pure returns (bytes4 _data) {
        return bytes4(keccak256(abi.encodePacked("erc-to-native-core")));
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
        setTotalExecutedPerDay(getCurrentDay(), totalExecutedPerDay(getCurrentDay()).add(_amount));
        uint256 amount = _amount.div(10 ** decimalShift());
        return erc20token().transfer(_recipient, amount);
    }

    function onFailedMessage(address, uint256, bytes32) internal {
        revert();
    }
}
