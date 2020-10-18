pragma solidity 0.4.24;

import "./BaseAddressList.sol";
import "./Ownable.sol";
import "./InitializableBridge.sol";

contract BaseBridgeValidators is BaseAddressList, Ownable, InitializableBridge {
    bytes32 internal constant REQUIRED_SIGNATURES = 0xd18ea17c351d6834a0e568067fb71804d2a588d5e26d60f792b1c724b1bd53b1; // keccak256(abi.encodePacked("requiredSignatures"))

    event ValidatorAdded(address indexed validator);
    event ValidatorRemoved(address indexed validator);
    event RequiredSignaturesChanged(uint256 requiredSignatures);

    function getBridgeValidatorsInterfacesVersion() external pure returns (uint64 major, uint64 minor, uint64 patch) {
        return (2, 4, 0);
    }

    function setRequiredSignatures(uint256 _requiredSignatures) external onlyOwner {
        require(_addressCount() >= _requiredSignatures);
        _setRequiredSignatures(_requiredSignatures);
    }

    function isValidatorDuty(address _validator) external view returns (bool) {
        uint256 count = _addressCount();
        uint256 index = _addressIndex(_validator, count);

        return (block.number % count == index);
    }

    function requiredSignatures() public view returns (uint256) {
        return uintStorage[REQUIRED_SIGNATURES];
    }

    function validatorList() external view returns (address[]) {
        return _addressList();
    }

    function validatorCount() external view returns (uint256) {
        return _addressCount();
    }

    function isValidator(address _validator) external view returns (bool) {
        uint256 count = _addressCount();
        return _addressIndex(_validator, count) < count;
    }

    function _setRequiredSignatures(uint256 _requiredSignatures) internal {
        require(_requiredSignatures > 0);
        uintStorage[REQUIRED_SIGNATURES] = _requiredSignatures;

        emit RequiredSignaturesChanged(_requiredSignatures);
    }
}
