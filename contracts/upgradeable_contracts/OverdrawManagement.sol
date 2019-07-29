pragma solidity 0.4.24;

import "../upgradeability/EternalStorage.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "./Upgradeable.sol";
import "./RewardableBridge.sol";

contract OverdrawManagement is EternalStorage, RewardableBridge, Upgradeable {
    using SafeMath for uint256;

    event UserRequestForSignature(address recipient, uint256 value);

    function fixAssetsAboveLimits(bytes32 txHash, bool unlockOnForeign) external onlyIfUpgradeabilityOwner {
        require(!fixedAssets(txHash));
        address recipient;
        uint256 value;
        (recipient, value) = txAboveLimits(txHash);
        require(recipient != address(0) && value > 0);
        setOutOfLimitAmount(outOfLimitAmount().sub(value));
        if (unlockOnForeign) {
            address feeManager = feeManagerContract();
            if (feeManager != address(0)) {
                uint256 fee = calculateFee(value, false, feeManager, HOME_FEE);
                value = value.sub(fee);
            }
            emit UserRequestForSignature(recipient, value);
        }
        setFixedAssets(txHash);
    }

    function outOfLimitAmount() public view returns (uint256) {
        return uintStorage[keccak256(abi.encodePacked("outOfLimitAmount"))];
    }

    function fixedAssets(bytes32 _txHash) public view returns (bool) {
        return boolStorage[keccak256(abi.encodePacked("fixedAssets", _txHash))];
    }

    function setOutOfLimitAmount(uint256 _value) internal {
        uintStorage[keccak256(abi.encodePacked("outOfLimitAmount"))] = _value;
    }

    function txAboveLimits(bytes32 _txHash) internal view returns (address recipient, uint256 value) {
        recipient = addressStorage[keccak256(abi.encodePacked("txOutOfLimitRecipient", _txHash))];
        value = uintStorage[keccak256(abi.encodePacked("txOutOfLimitValue", _txHash))];
    }

    function setTxAboveLimits(address _recipient, uint256 _value, bytes32 _txHash) internal {
        addressStorage[keccak256(abi.encodePacked("txOutOfLimitRecipient", _txHash))] = _recipient;
        uintStorage[keccak256(abi.encodePacked("txOutOfLimitValue", _txHash))] = _value;
    }

    function setFixedAssets(bytes32 _txHash) internal {
        boolStorage[keccak256(abi.encodePacked("fixedAssets", _txHash))] = true;
    }
}
