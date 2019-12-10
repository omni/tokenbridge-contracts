pragma solidity 0.4.24;

import "../../interfaces/IBurnableMintableERC677Token.sol";
import "../BasicForeignBridge.sol";
import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import "../ERC677BridgeForBurnableMintableToken.sol";
import "./RewardableForeignBridgeNativeToErc.sol";

contract ForeignBridgeNativeToErc is
    BasicForeignBridge,
    ERC677BridgeForBurnableMintableToken,
    RewardableForeignBridgeNativeToErc
{
    function initialize(
        address _validatorContract,
        address _erc677token,
        // absolute: [ 0 = _dailyLimit, 1 = _maxPerTx, 2 = _minPerTx ]
        // relative: [ 0 = _targetLimit, 1 = threshold, 2 = _maxPerTx, 3 = _minPerTx ]
        uint256[] _requestLimitsArray,
        uint256 _foreignGasPrice,
        uint256 _requiredBlockConfirmations,
        uint256[] _executionLimitsArray, // [ 0 = _executionDailyLimit, 1 = _executionMaxPerTx, 2 = _executionMinPerTx ]
        address _owner,
        uint256 _decimalShift,
        address _bridgeOnOtherSide,
        address _limitsContract
    ) public returns (bool) {
        require(!isInitialized());
        require(AddressUtils.isContract(_validatorContract));
        require(_requiredBlockConfirmations > 0);
        require(_foreignGasPrice > 0);
        require(_owner != address(0));
        require(AddressUtils.isContract(_limitsContract));

        addressStorage[VALIDATOR_CONTRACT] = _validatorContract;
        setErc677token(_erc677token);
        uintStorage[DEPLOYED_AT_BLOCK] = block.number;
        uintStorage[GAS_PRICE] = _foreignGasPrice;
        uintStorage[REQUIRED_BLOCK_CONFIRMATIONS] = _requiredBlockConfirmations;
        uintStorage[DECIMAL_SHIFT] = _decimalShift;
        setOwner(_owner);
        _setBridgeContractOnOtherSide(_bridgeOnOtherSide);
        addressStorage[LIMITS_CONTRACT] = _limitsContract;
        _setLimits(_requestLimitsArray, _executionLimitsArray);

        emit RequiredBlockConfirmationChanged(_requiredBlockConfirmations);
        emit GasPriceChanged(_foreignGasPrice);

        setInitialize();
        return isInitialized();
    }

    function rewardableInitialize(
        address _validatorContract,
        address _erc677token,
        // absolute: [ 0 = _dailyLimit, 1 = _maxPerTx, 2 = _minPerTx ]
        // relative: [ 0 = _targetLimit, 1 = threshold, 2 = _maxPerTx, 3 = _minPerTx ]
        uint256[] _requestLimitsArray,
        uint256 _foreignGasPrice,
        uint256 _requiredBlockConfirmations,
        uint256[] _executionLimitsArray, // [ 0 = _executionDailyLimit, 1 = _executionMaxPerTx, 2 = _executionMinPerTx ]
        address _owner,
        address _feeManager,
        uint256 _homeFee,
        uint256 _decimalShift,
        address _bridgeOnOtherSide,
        address _limitsContract
    ) external returns (bool) {
        require(AddressUtils.isContract(_feeManager));
        addressStorage[FEE_MANAGER_CONTRACT] = _feeManager;
        _setFee(_feeManager, _homeFee, HOME_FEE);
        return
            initialize(
                _validatorContract,
                _erc677token,
                _requestLimitsArray,
                _foreignGasPrice,
                _requiredBlockConfirmations,
                _executionLimitsArray,
                _owner,
                _decimalShift,
                _bridgeOnOtherSide,
                _limitsContract
            );
    }

    function getBridgeMode() external pure returns (bytes4 _data) {
        return 0x92a8d7fe; // bytes4(keccak256(abi.encodePacked("native-to-erc-core")))
    }

    function claimTokensFromErc677(address _token, address _to) external onlyIfUpgradeabilityOwner {
        IBurnableMintableERC677Token(erc677token()).claimTokens(_token, _to);
    }

    function onExecuteMessage(address _recipient, uint256 _amount, bytes32 _txHash) internal returns (bool) {
        _increaseTotalExecutedPerDay(_amount);
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

    function _getTokenBalance() internal view returns (uint256) {
        return erc677token().totalSupply();
    }
}
