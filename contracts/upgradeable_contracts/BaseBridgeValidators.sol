pragma solidity 0.4.24;

import "./BaseAddressList.sol";
import "./Ownable.sol";
import "./InitializableBridge.sol";

contract BaseBridgeValidators is BaseAddressList, Ownable, InitializableBridge {
    bytes32 internal constant REQUIRED_SIGNATURES = 0xd18ea17c351d6834a0e568067fb71804d2a588d5e26d60f792b1c724b1bd53b1; // keccak256(abi.encodePacked("requiredSignatures"))

    event ValidatorAdded(address indexed validator);
    event ValidatorRemoved(address indexed validator);
    event RequiredSignaturesChanged(uint256 requiredSignatures);

    /**
     * @dev Tells the bridge validators interface version that this contract supports.
     * @return major value of the version
     * @return minor value of the version
     * @return patch value of the version
     */
    function getBridgeValidatorsInterfacesVersion() external pure returns (uint64 major, uint64 minor, uint64 patch) {
        return (2, 4, 0);
    }

    /**
     * @dev Updates the amount of required signatures for some action on behalf of validators.
     * Only owner can call this method.
     * @param _requiredSignatures new number of required signatures. Should be positive and attainable.
     */
    function setRequiredSignatures(uint256 _requiredSignatures) external onlyOwner {
        _setRequiredSignatures(_requiredSignatures);
    }

    /**
     * @dev Checks if some particular validator is responsible for message relay.
     * @param _validator address of validator to check responsibility for.
     * @return true, if given validator should proceed with the relay.
     */
    function isValidatorDuty(address _validator) external view returns (bool) {
        uint256 count = _addressCount();
        uint256 index = _addressIndex(_validator, count);

        return block.number % count == index;
    }

    /**
     * @dev Tells the amount of required signatures for performing an action of behalf of validators.
     * @return number of required signatures.
     */
    function requiredSignatures() public view returns (uint256) {
        return uintStorage[REQUIRED_SIGNATURES];
    }

    /**
     * @dev Retrieves the full set of validators stored in the contract.
     * @return array with all validators addresses.
     */
    function validatorList() external view returns (address[]) {
        return _addressList();
    }

    /**
     * @dev Tells the number of registered validators.
     * @return number of validators.
     */
    function validatorCount() external view returns (uint256) {
        return _addressCount();
    }

    /**
     * @dev Checks if some particular address is included into the validators list.
     * @param _validator address to check.
     * @return true, if given address belongs to one of the current validators.
     */
    function isValidator(address _validator) external view returns (bool) {
        uint256 count = _addressCount();
        return _addressIndex(_validator, count) < count;
    }

    /**
     * @dev Internal function for updating required signatures parameter.
     * @param _requiredSignatures new value for the parameter. Should be positive and attainble.
     */
    function _setRequiredSignatures(uint256 _requiredSignatures) internal {
        require(_addressCount() >= _requiredSignatures && _requiredSignatures > 0);
        uintStorage[REQUIRED_SIGNATURES] = _requiredSignatures;

        emit RequiredSignaturesChanged(_requiredSignatures);
    }
}
