pragma solidity 0.4.24;

import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "./Upgradeable.sol";
import "./RewardableBridge.sol";
import "./BasicTokenBridge.sol";
import "./BaseOverdrawManagement.sol";

contract OverdrawManagement is BaseOverdrawManagement, RewardableBridge, Upgradeable, BasicTokenBridge {
    using SafeMath for uint256;

    event UserRequestForSignature(address recipient, uint256 value);

    function fixAssetsAboveLimits(
        bytes32 txHash,
        bool unlockOnForeign,
        uint256 valueToUnlock
    ) external onlyIfUpgradeabilityOwner {
        require(!fixedAssets(txHash));
        require(valueToUnlock <= maxPerTx());
        address recipient;
        uint256 value;
        (recipient, value) = txAboveLimits(txHash);
        require(recipient != address(0) && value > 0 && value >= valueToUnlock);
        setOutOfLimitAmount(outOfLimitAmount().sub(valueToUnlock));
        uint256 pendingValue = value.sub(valueToUnlock);
        setTxAboveLimitsValue(pendingValue, txHash);
        emit AssetAboveLimitsFixed(txHash, valueToUnlock, pendingValue);
        if (pendingValue == 0) {
            setFixedAssets(txHash);
        }
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
