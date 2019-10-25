pragma solidity 0.4.24;

import "../../interfaces/IBurnableMintableERC677Token.sol";
import "../BasicForeignBridge.sol";
import "openzeppelin-solidity/contracts/token/ERC20/ERC20Basic.sol";
import "../ERC677BridgeForBurnableMintableToken.sol";
import "./RewardableForeignBridgeNativeToErc.sol";

contract ForeignBridgeNativeToErc is
    BasicForeignBridge,
    ERC677BridgeForBurnableMintableToken,
    RewardableForeignBridgeNativeToErc
{
    /// Event created on money withdraw.
    event UserRequestForAffirmation(address recipient, uint256 value);

    function initialize(
        address _validatorContract,
        address _erc677token,
        uint256[] _dailyLimitMaxPerTxMinPerTxArray, // [ 0 = _dailyLimit, 1 = _maxPerTx, 2 = _minPerTx ]
        uint256 _foreignGasPrice,
        uint256 _requiredBlockConfirmations,
        uint256[] _homeDailyLimitHomeMaxPerTxHomeMinPerTxArray, // [ 0 = _homeDailyLimit, 1 = _homeMaxPerTx, 2 = _homeMinPerTx ]
        address _owner,
        uint256 _decimalShift
    ) external returns (bool) {
        _setLimits(
            _dailyLimitMaxPerTxMinPerTxArray,
            _homeDailyLimitHomeMaxPerTxHomeMinPerTxArray
        );
        _initialize(
            _validatorContract,
            _erc677token,
            _foreignGasPrice,
            _requiredBlockConfirmations,
            _owner,
            _decimalShift
        );
        setInitialize();
        return isInitialized();
    }

    function rewardableInitialize(
        address _validatorContract,
        address _erc677token,
        uint256[] _dailyLimitMaxPerTxMinPerTxArray, // [ 0 = _dailyLimit, 1 = _maxPerTx, 2 = _minPerTx ]
        uint256 _foreignGasPrice,
        uint256 _requiredBlockConfirmations,
        uint256[] _homeDailyLimitHomeMaxPerTxHomeMinPerTxArray, // [ 0 = _homeDailyLimit, 1 = _homeMaxPerTx, 2 = _homeMinPerTx ]
        address _owner,
        address _feeManager,
        uint256 _homeFee,
        uint256 _decimalShift
    ) external returns (bool) {
        _setLimits(
            _dailyLimitMaxPerTxMinPerTxArray,
            _homeDailyLimitHomeMaxPerTxHomeMinPerTxArray
        );
        _initialize(
            _validatorContract,
            _erc677token,
            _foreignGasPrice,
            _requiredBlockConfirmations,
            _owner,
            _decimalShift
        );
        require(AddressUtils.isContract(_feeManager));
        addressStorage[FEE_MANAGER_CONTRACT] = _feeManager;
        _setFee(_feeManager, _homeFee, HOME_FEE);
        setInitialize();
        return isInitialized();
    }

    function getBridgeMode() external pure returns (bytes4 _data) {
        return 0x92a8d7fe; // bytes4(keccak256(abi.encodePacked("native-to-erc-core")))
    }

    function claimTokensFromErc677(address _token, address _to) external onlyIfUpgradeabilityOwner {
        IBurnableMintableERC677Token(erc677token()).claimTokens(_token, _to);
    }

    function _setLimits(
        uint256[] _dailyLimitMaxPerTxMinPerTxArray, // [ 0 = _dailyLimit, 1 = _maxPerTx, 2 = _minPerTx ]
        uint256[] _homeDailyLimitHomeMaxPerTxHomeMinPerTxArray // [ 0 = _homeDailyLimit, 1 = _homeMaxPerTx, 2 = _homeMinPerTx ]
    ) internal {
        require(
            _dailyLimitMaxPerTxMinPerTxArray[2] > 0 && // _minPerTx > 0
                _dailyLimitMaxPerTxMinPerTxArray[1] > _dailyLimitMaxPerTxMinPerTxArray[2] && // _maxPerTx > _minPerTx
                _dailyLimitMaxPerTxMinPerTxArray[0] > _dailyLimitMaxPerTxMinPerTxArray[1] // _dailyLimit > _maxPerTx
        );
        require(
            _homeDailyLimitHomeMaxPerTxHomeMinPerTxArray[2] > 0 && // _homeMinPerTx > 0
            _homeDailyLimitHomeMaxPerTxHomeMinPerTxArray[1] > _homeDailyLimitHomeMaxPerTxHomeMinPerTxArray[2] && // _homeMaxPerTx > _homeMinPerTx
            _homeDailyLimitHomeMaxPerTxHomeMinPerTxArray[1] < _homeDailyLimitHomeMaxPerTxHomeMinPerTxArray[0] // _homeMaxPerTx < _homeDailyLimit
        );

        uintStorage[DAILY_LIMIT] = _dailyLimitMaxPerTxMinPerTxArray[0];
        uintStorage[MAX_PER_TX] = _dailyLimitMaxPerTxMinPerTxArray[1];
        uintStorage[MIN_PER_TX] = _dailyLimitMaxPerTxMinPerTxArray[2];
        uintStorage[EXECUTION_DAILY_LIMIT] = _homeDailyLimitHomeMaxPerTxHomeMinPerTxArray[0];
        uintStorage[EXECUTION_MAX_PER_TX] = _homeDailyLimitHomeMaxPerTxHomeMinPerTxArray[1];
        uintStorage[EXECUTION_MIN_PER_TX] = _homeDailyLimitHomeMaxPerTxHomeMinPerTxArray[2];

        emit DailyLimitChanged(_dailyLimitMaxPerTxMinPerTxArray[0]);
        emit ExecutionDailyLimitChanged(_homeDailyLimitHomeMaxPerTxHomeMinPerTxArray[0]);
    }

    function _initialize(
        address _validatorContract,
        address _erc677token,
        uint256 _foreignGasPrice,
        uint256 _requiredBlockConfirmations,
        address _owner,
        uint256 _decimalShift
    ) internal {
        require(!isInitialized());
        require(AddressUtils.isContract(_validatorContract));
        require(_requiredBlockConfirmations > 0);
        require(_foreignGasPrice > 0);
        require(_owner != address(0));

        addressStorage[VALIDATOR_CONTRACT] = _validatorContract;
        setErc677token(_erc677token);
        uintStorage[DEPLOYED_AT_BLOCK] = block.number;
        uintStorage[GAS_PRICE] = _foreignGasPrice;
        uintStorage[REQUIRED_BLOCK_CONFIRMATIONS] = _requiredBlockConfirmations;
        uintStorage[DECIMAL_SHIFT] = _decimalShift;
        setOwner(_owner);

        emit RequiredBlockConfirmationChanged(_requiredBlockConfirmations);
        emit GasPriceChanged(_foreignGasPrice);
    }

    function onExecuteMessage(address _recipient, uint256 _amount, bytes32 _txHash) internal returns (bool) {
        setTotalExecutedPerDay(getCurrentDay(), totalExecutedPerDay(getCurrentDay()).add(_amount));
        uint256 valueToMint = _amount.div(10**decimalShift());
        address feeManager = feeManagerContract();
        if (feeManager != address(0)) {
            uint256 fee = calculateFee(valueToMint, false, feeManager, HOME_FEE);
            if (fee != 0) {
                distributeFeeFromSignatures(fee, feeManager, _txHash);
                valueToMint = valueToMint.sub(fee);
            }
        }
        return IBurnableMintableERC677Token(erc677token()).mint(_recipient, valueToMint);
    }

    function fireEventOnTokenTransfer(address _from, uint256 _value) internal {
        emit UserRequestForAffirmation(_from, _value);
    }

    function onFailedMessage(address, uint256, bytes32) internal {
        revert();
    }
}
