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
    * @param valueToUnlock unlocked amount of tokens, should be less than maxPerTx() and saved txAboveLimitsValue.
    */
    function fixAssetsAboveLimits(bytes32 hashMsg, bool unlockOnForeign, uint256 valueToUnlock)
        external
        onlyIfUpgradeabilityOwner
    {
        uint256 signed = numAffirmationsSigned(hashMsg);
        require(!isAlreadyProcessed(signed));
        require(valueToUnlock <= maxPerTx());
        (address recipient, uint256 value) = txAboveLimits(hashMsg);
        require(recipient != address(0) && value > 0 && value >= valueToUnlock);
        setOutOfLimitAmount(outOfLimitAmount().sub(valueToUnlock));
        uint256 pendingValue = value.sub(valueToUnlock);
        setTxAboveLimitsValue(pendingValue, hashMsg);
        emit AssetAboveLimitsFixed(hashMsg, valueToUnlock, pendingValue);
        if (unlockOnForeign) {
            address feeManager = feeManagerContract();
            uint256 eventValue = valueToUnlock;
            if (feeManager != address(0)) {
                uint256 fee = calculateFee(valueToUnlock, false, feeManager, HOME_FEE);
                eventValue = valueToUnlock.sub(fee);
            }
            emit UserRequestForSignature(recipient, eventValue);
        }
    }
}
