pragma solidity 0.4.24;

import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "./Upgradeable.sol";
import "./RewardableBridge.sol";
import "./BasicHomeBridge.sol";
import "./BaseOverdrawManagement.sol";

/**
 * @title HomeOverdrawManagement
 * @dev This contract implements functionality for recovering from out-of-limits executions in Home side vanilla bridges.
 */
contract HomeOverdrawManagement is BaseOverdrawManagement, RewardableBridge, Upgradeable, BasicHomeBridge {
    using SafeMath for uint256;

    /**
    * @dev Fixes locked tokens, that were out of execution limits during the call to executeAffirmation.
    * @param hashMsg reference for bridge operation that was out of execution limits.
    * @param unlockOnForeign true if fixed tokens should be unlocked to the other side of the bridge.
    * @param valueToUnlock unlocked amount of tokens, should be less than txAboveLimitsValue.
    * Should be less than maxPerTx(), if tokens need to be unlocked on the other side.
    */
    function fixAssetsAboveLimits(bytes32 hashMsg, bool unlockOnForeign, uint256 valueToUnlock)
        external
        onlyIfUpgradeabilityOwner
    {
        uint256 signed = numAffirmationsSigned(hashMsg);
        require(!isAlreadyProcessed(signed));
        (address recipient, uint256 value) = txAboveLimits(hashMsg);
        require(recipient != address(0) && value > 0 && value >= valueToUnlock);
        setOutOfLimitAmount(outOfLimitAmount().sub(valueToUnlock));
        uint256 pendingValue = value.sub(valueToUnlock);
        setTxAboveLimitsValue(pendingValue, hashMsg);
        emit AssetAboveLimitsFixed(hashMsg, valueToUnlock, pendingValue);
        if (unlockOnForeign) {
            require(valueToUnlock <= maxPerTx());
            address feeManager = feeManagerContract();
            uint256 eventValue = valueToUnlock;
            if (feeManager != address(0)) {
                uint256 fee = calculateFee(valueToUnlock, false, feeManager, HOME_FEE);
                eventValue = valueToUnlock.sub(fee);
            }
            emit UserRequestForSignature(recipient, eventValue);
        }
    }

    /**
     * @dev Internal function for clearing above limits markers for some failed transfer.
     * Useful when transfer is being reprocessed on a new day or after limits were updated.
     * It is required that fixAssetsAboveLimits was not called on the failed transfer before prior to this function.
     * @param _hashMsg hash of the message, works as a unique indentifier.
     * @param _value transferred amount of tokens/coins in the fixed message.
     */
    function _clearAboveLimitsMarker(bytes32 _hashMsg, uint256 _value) internal {
        (address aboveLimitsRecipient, uint256 aboveLimitsValue) = txAboveLimits(_hashMsg);
        // check if transfer was marked as out of limits
        if (aboveLimitsRecipient != address(0)) {
            // revert if a given transaction hash was already processed by the call to fixAssetsAboveLimits
            require(aboveLimitsValue == _value);
            setTxAboveLimits(address(0), 0, _hashMsg);
            setOutOfLimitAmount(outOfLimitAmount().sub(_value));
        }
    }
}
