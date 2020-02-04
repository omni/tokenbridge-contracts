pragma solidity 0.4.24;

import "../Initializable.sol";
import "../Ownable.sol";
import "../BasicTokenBridge.sol";
import "../Upgradeable.sol";
import "../Claimable.sol";
import "../VersionableBridge.sol";
import "../TokenBridgeMediator.sol";

/**
* @title BasicAMBNativeToErc20
* @dev Common mediator functionality for native-to-erc20 bridge intended to work on top of AMB bridge.
*/
contract BasicAMBNativeToErc20 is Initializable, Upgradeable, Claimable, VersionableBridge, TokenBridgeMediator {
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
    */
    function _initialize(
        address _bridgeContract,
        address _mediatorContract,
        uint256[] _dailyLimitMaxPerTxMinPerTxArray,
        uint256[] _executionDailyLimitExecutionMaxPerTxArray,
        uint256 _requestGasLimit,
        uint256 _decimalShift,
        address _owner
    ) internal {
        require(!isInitialized());
        require(
            _dailyLimitMaxPerTxMinPerTxArray[2] > 0 && // minPerTx > 0
                _dailyLimitMaxPerTxMinPerTxArray[1] > _dailyLimitMaxPerTxMinPerTxArray[2] && // maxPerTx > minPerTx
                _dailyLimitMaxPerTxMinPerTxArray[0] > _dailyLimitMaxPerTxMinPerTxArray[1] // dailyLimit > maxPerTx
        );
        require(_executionDailyLimitExecutionMaxPerTxArray[1] < _executionDailyLimitExecutionMaxPerTxArray[0]); // foreignMaxPerTx < foreignDailyLimit
        require(_owner != address(0));

        uintStorage[DAILY_LIMIT] = _dailyLimitMaxPerTxMinPerTxArray[0];
        uintStorage[MAX_PER_TX] = _dailyLimitMaxPerTxMinPerTxArray[1];
        uintStorage[MIN_PER_TX] = _dailyLimitMaxPerTxMinPerTxArray[2];
        uintStorage[EXECUTION_DAILY_LIMIT] = _executionDailyLimitExecutionMaxPerTxArray[0];
        uintStorage[EXECUTION_MAX_PER_TX] = _executionDailyLimitExecutionMaxPerTxArray[1];
        uintStorage[DECIMAL_SHIFT] = _decimalShift;
        setOwner(_owner);
        setNonce(keccak256(abi.encodePacked(address(this))));

        emit DailyLimitChanged(_dailyLimitMaxPerTxMinPerTxArray[0]);
        emit ExecutionDailyLimitChanged(_executionDailyLimitExecutionMaxPerTxArray[0]);
    }

    /**
    * @dev Tells the bridge interface version that this contract supports.
    * @return major value of the version
    * @return minor value of the version
    * @return patch value of the version
    */
    function getBridgeInterfacesVersion() external pure returns (uint64 major, uint64 minor, uint64 patch) {
        return (1, 0, 0);
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
    * @param _recipient address intended to receive the tokens
    * @param _value amount of tokens to be received
    */
    function executeActionOnBridgedTokensOutOfLimit(address _recipient, uint256 _value) internal {
        revert();
    }

    /**
    * @dev Allows to transfer any locked token on this contract that is not part of the bridge operations.
    * @param _token address of the token, if it is not provided, native tokens will be transferred.
    * @param _to address that will receive the locked tokens on this contract.
    */
    function claimTokens(address _token, address _to) public onlyIfUpgradeabilityOwner validAddress(_to) {
        claimValues(_token, _to);
    }
}
