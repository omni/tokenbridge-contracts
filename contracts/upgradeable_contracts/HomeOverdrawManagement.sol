pragma solidity 0.4.24;

import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "./Upgradeable.sol";
import "./RewardableBridge.sol";
import "./BasicHomeBridge.sol";
import "./BaseOverdrawManagement.sol";

contract HomeOverdrawManagement is BaseOverdrawManagement, RewardableBridge, Upgradeable, BasicHomeBridge {
    using SafeMath for uint256;

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
