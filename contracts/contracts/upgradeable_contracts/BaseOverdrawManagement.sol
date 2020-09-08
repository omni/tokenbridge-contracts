pragma solidity 0.4.24;

import "../upgradeability/EternalStorage.sol";

contract BaseOverdrawManagement is EternalStorage {
    event AmountLimitExceeded(address recipient, uint256 value, bytes32 transactionHash);
    event AssetAboveLimitsFixed(bytes32 indexed transactionHash, uint256 value, uint256 remaining);

    bytes32 internal constant OUT_OF_LIMIT_AMOUNT = 0x145286dc85799b6fb9fe322391ba2d95683077b2adf34dd576dedc437e537ba7; // keccak256(abi.encodePacked("outOfLimitAmount"))

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

    function setTxAboveLimits(
        address _recipient,
        uint256 _value,
        bytes32 _txHash
    ) internal {
        addressStorage[keccak256(abi.encodePacked("txOutOfLimitRecipient", _txHash))] = _recipient;
        setTxAboveLimitsValue(_value, _txHash);
    }

    function setTxAboveLimitsValue(uint256 _value, bytes32 _txHash) internal {
        uintStorage[keccak256(abi.encodePacked("txOutOfLimitValue", _txHash))] = _value;
    }

    function setFixedAssets(bytes32 _txHash) internal {
        boolStorage[keccak256(abi.encodePacked("fixedAssets", _txHash))] = true;
    }

    /* solcov ignore next */
    function fixAssetsAboveLimits(
        bytes32 txHash,
        bool unlockOnForeign,
        uint256 valueToUnlock
    ) external;
}
