pragma solidity 0.4.24;

import "../Initializable.sol";
import "../Upgradeable.sol";
import "../Claimable.sol";
import "../VersionableBridge.sol";
import "../TokenBridgeMediator.sol";
import "../RewardableMediator.sol";

/**
* @title BasicAMBNativeToErc20
* @dev Common mediator functionality for native-to-erc20 bridge intended to work on top of AMB bridge.
*/
contract BasicAMBNativeToErc20 is
    Initializable,
    Upgradeable,
    Claimable,
    VersionableBridge,
    TokenBridgeMediator,
    RewardableMediator
{
    /**
    * @dev Stores the initial parameters of the mediator.
    * @param _bridgeContract the address of the AMB bridge contract.
    * @param _mediatorContract the address of the mediator contract on the other network.
    * @param _dailyLimitMaxPerTxMinPerTxArray array with limit values for the assets to be bridged to the other network.
    *   [ 0 = dailyLimit, 1 = maxPerTx, 2 = minPerTx ]
    * @param _executionDailyLimitExecutionMaxPerTxArray array with limit values for the assets bridged from the other network.
    *   [ 0 = executionDailyLimit, 1 = executionMaxPerTx ]
    * @param _requestGasLimit the gas limit for the message execution.
    * @param _decimalShift number of decimals shift required to adjust the amount of tokens bridged.
    * @param _owner address of the owner of the mediator contract
    * @param _feeManager address of the fee manager contract
    */
    function _initialize(
        address _bridgeContract,
        address _mediatorContract,
        uint256[3] _dailyLimitMaxPerTxMinPerTxArray,
        uint256[2] _executionDailyLimitExecutionMaxPerTxArray,
        uint256 _requestGasLimit,
        int256 _decimalShift,
        address _owner,
        address _feeManager
    ) internal {
        require(!isInitialized());

        _setBridgeContract(_bridgeContract);
        _setMediatorContractOnOtherSide(_mediatorContract);
        _setRequestGasLimit(_requestGasLimit);
        _setLimits(_dailyLimitMaxPerTxMinPerTxArray);
        _setExecutionLimits(_executionDailyLimitExecutionMaxPerTxArray);
        _setDecimalShift(_decimalShift);
        _setFeeManagerContract(_feeManager);
        _setOwner(_owner);
    }

    /**
    * @dev Tells the bridge interface version that this contract supports.
    * @return major value of the version
    * @return minor value of the version
    * @return patch value of the version
    */
    function getBridgeInterfacesVersion() external pure returns (uint64 major, uint64 minor, uint64 patch) {
        return (1, 2, 0);
    }

    /**
    * @dev Tells the bridge mode that this contract supports.
    * @return _data 4 bytes representing the bridge mode
    */
    function getBridgeMode() external pure returns (bytes4 _data) {
        return 0x582ed8fd; // bytes4(keccak256(abi.encodePacked("native-to-erc-amb")))
    }

    /**
    * @dev Execute the action to be performed when the bridge tokens are out of execution limits.
    */
    function executeActionOnBridgedTokensOutOfLimit(
        address, /* _recipient */
        uint256 /* _value */
    ) internal {
        revert();
    }
}
