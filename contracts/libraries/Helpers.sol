pragma solidity 0.4.19;
import "../IBridgeValidators.sol";
import "./MessageSigning.sol";

library Helpers {
    function addressArrayContains(address[] array, address value) internal pure returns (bool) {
        for (uint256 i = 0; i < array.length; i++) {
            if (array[i] == value) {
                return true;
            }
        }
        return false;
    }

    function uintToString(uint256 inputValue) internal pure returns (string) {
        // figure out the length of the resulting string
        uint256 length = 0;
        uint256 currentValue = inputValue;
        do {
            length++;
            currentValue /= 10;
        } while (currentValue != 0);
        // allocate enough memory
        bytes memory result = new bytes(length);
        // construct the string backwards
        uint256 i = length - 1;
        currentValue = inputValue;
        do {
            result[i--] = byte(48 + currentValue % 10);
            currentValue /= 10;
        } while (currentValue != 0);
        return string(result);
    }

    function hasEnoughValidSignatures(
        bytes _message,
        uint8[] _vs,
        bytes32[] _rs,
        bytes32[] _ss,
        IBridgeValidators _validatorContract) internal view returns (bool) {
        uint8 _requiredSignatures = _validatorContract.requiredSignatures();
        require(_vs.length < _requiredSignatures);
        bytes32 hash = MessageSigning.hashMessage(_message);
        address[] memory encounteredAddresses = new address[](_requiredSignatures);

        for (uint8 i = 0; i < _requiredSignatures; i++) {
            address recoveredAddress = ecrecover(hash, _vs[i], _rs[i], _ss[i]);
            // only signatures by addresses in `addresses` are allowed
            require(_validatorContract.isValidator(recoveredAddress));
            // duplicate signatures are not allowed
            if (addressArrayContains(encounteredAddresses, recoveredAddress)) {
                return false;
            }
            encounteredAddresses[i] = recoveredAddress;
        }
        return true;
    }
}
