pragma solidity 0.4.24;

import "../upgradeability/EternalStorage.sol";

/**
 * @title BaseOverdrawManagement
 * @dev This contract implements basic functionality for tracking execution bridge operations that are out of limits.
 */
contract BaseOverdrawManagement is EternalStorage {
    event MediatorAmountLimitExceeded(address recipient, uint256 value, bytes32 indexed messageId);
    event AmountLimitExceeded(address recipient, uint256 value, bytes32 indexed transactionHash, bytes32 messageId);
    event AssetAboveLimitsFixed(bytes32 indexed messageId, uint256 value, uint256 remaining);

    bytes32 internal constant OUT_OF_LIMIT_AMOUNT = 0x145286dc85799b6fb9fe322391ba2d95683077b2adf34dd576dedc437e537ba7; // keccak256(abi.encodePacked("outOfLimitAmount"))

    /**
     * @dev Total amount coins/tokens that were bridged from the other side and are out of execution limits.
     * @return total amount of all bridge operations above limits.
     */
    function outOfLimitAmount() public view returns (uint256) {
        return uintStorage[OUT_OF_LIMIT_AMOUNT];
    }

    /**
     * @dev Internal function for updating a total amount that is out of execution limits.
     * @param _value new value for the total amount of bridge operations above limits.
     */
    function setOutOfLimitAmount(uint256 _value) internal {
        uintStorage[OUT_OF_LIMIT_AMOUNT] = _value;
    }

    /**
     * @dev Internal function for retrieving information about out-of-limits bridge operation.
     * @param _messageId id of the message that cause above-limits error.
     * @return (address of the receiver, amount of coins/tokens in the bridge operation)
     */
    function txAboveLimits(bytes32 _messageId) internal view returns (address recipient, uint256 value) {
        recipient = addressStorage[keccak256(abi.encodePacked("txOutOfLimitRecipient", _messageId))];
        value = uintStorage[keccak256(abi.encodePacked("txOutOfLimitValue", _messageId))];
    }

    /**
     * @dev Internal function for updating information about tbe out-of-limits bridge operation.
     * @param _recipient receiver specified in the bridge operation.
     * @param _value amount of coins/tokens inside the bridge operation.
     * @param _messageId id of the message that cause above-limits error.
     */
    function setTxAboveLimits(address _recipient, uint256 _value, bytes32 _messageId) internal {
        addressStorage[keccak256(abi.encodePacked("txOutOfLimitRecipient", _messageId))] = _recipient;
        setTxAboveLimitsValue(_value, _messageId);
    }

    /**
     * @dev Internal function for updating information about the remaining value of out-of-limits bridge operation.
     * @param _value amount of coins/tokens inside the bridge operation.
     * @param _messageId id of the message that cause above-limits error.
     */
    function setTxAboveLimitsValue(uint256 _value, bytes32 _messageId) internal {
        uintStorage[keccak256(abi.encodePacked("txOutOfLimitValue", _messageId))] = _value;
    }

    /* solcov ignore next */
    function fixAssetsAboveLimits(bytes32 messageId, bool unlockOnForeign, uint256 valueToUnlock) external;
}
