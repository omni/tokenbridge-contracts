pragma solidity 0.4.24;

import "../upgradeability/EternalStorage.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "./Upgradeable.sol";
import "./RewardableBridge.sol";
import "./BasicBridge.sol";

contract OverdrawManagement is EternalStorage, RewardableBridge, Upgradeable, BasicBridge {
    using SafeMath for uint256;

    event UserRequestForSignature(address recipient, uint256 value);
    event AssetAboveLimitsFixed(bytes32 indexed transactionHash, uint256 value, uint256 remaining);

    bytes32 internal constant OUT_OF_LIMIT_AMOUNT = keccak256(abi.encodePacked("outOfLimitAmount"));

    function fixAssetsAboveLimits(bytes32 txHash, bool unlockOnForeign, uint256 valueToUnlock)
        external
        onlyIfUpgradeabilityOwner
    {
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

    function outOfLimitAmount() public view returns (uint256) {
        return uintStorage[OUT_OF_LIMIT_AMOUNT];
    }

    function fixedAssets(bytes32 _txHash) public view returns (bool) {
        return boolStorage[keccak256(abi.encodePacked("fixedAssets", _txHash))];
    }

    function setOutOfLimitAmount(uint256 _value) internal {
        uintStorage[OUT_OF_LIMIT_AMOUNT] = _value;
    }

    function txAboveLimits(bytes32 _txHash) internal view returns (address recipient, uint256 value) {
        recipient = addressStorage[keccak256(abi.encodePacked("txOutOfLimitRecipient", _txHash))];
        value = uintStorage[keccak256(abi.encodePacked("txOutOfLimitValue", _txHash))];
    }

    function setTxAboveLimits(address _recipient, uint256 _value, bytes32 _txHash) internal {
        addressStorage[keccak256(abi.encodePacked("txOutOfLimitRecipient", _txHash))] = _recipient;
        setTxAboveLimitsValue(_value, _txHash);
    }

    function setTxAboveLimitsValue(uint256 _value, bytes32 _txHash) internal {
        uintStorage[keccak256(abi.encodePacked("txOutOfLimitValue", _txHash))] = _value;
    }

    function setFixedAssets(bytes32 _txHash) internal {
        boolStorage[keccak256(abi.encodePacked("fixedAssets", _txHash))] = true;
    }
}
