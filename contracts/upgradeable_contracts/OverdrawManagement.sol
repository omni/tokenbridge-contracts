pragma solidity 0.4.24;

import "../upgradeability/EternalStorage.sol";
import "./Validatable.sol";
import "../libraries/SafeMath.sol";


contract OverdrawManagement is EternalStorage, Validatable {
    using SafeMath for uint256;

    event UserRequestForSignature(address recipient, uint256 value);

    function fixAssetsAboveLimits(bytes32 txHash, bool unlockOnForeign) external onlyOwner {
        require(!fixedAssets(txHash));
        address recipient;
        uint256 value;
        (recipient, value) = txAboveLimits(txHash);
        require(recipient != address(0) && value > 0);
        setOutOfLimitAmount(outOfLimitAmount().sub(value));
        if (unlockOnForeign) {
            emit UserRequestForSignature(recipient, value);
        }
        setFixedAssets(txHash, true);
    }

    function outOfLimitAmount() public view returns(uint256) {
        return uintStorage[keccak256(abi.encodePacked("outOfLimitAmount"))];
    }

    function fixedAssets(bytes32 _txHash) public view returns(bool) {
        return boolStorage[keccak256(abi.encodePacked("fixedAssets", _txHash))];
    }

    function setOutOfLimitAmount(uint256 _value) internal {
        uintStorage[keccak256(abi.encodePacked("outOfLimitAmount"))] = _value;
    }

    function txAboveLimits(bytes32 _txHash) internal view returns(address recipient, uint256 value) {
        recipient = addressStorage[keccak256(abi.encodePacked("txOutOfLimitRecipient", _txHash))];
        value = uintStorage[keccak256(abi.encodePacked("txOutOfLimitValue", _txHash))];
    }

    function setTxAboveLimits(address _recipient, uint256 _value, bytes32 _txHash) internal {
        addressStorage[keccak256(abi.encodePacked("txOutOfLimitRecipient", _txHash))] = _recipient;
        uintStorage[keccak256(abi.encodePacked("txOutOfLimitValue", _txHash))] = _value;
    }

    function setFixedAssets(bytes32 _txHash, bool _status) internal {
        boolStorage[keccak256(abi.encodePacked("fixedAssets", _txHash))] = _status;
    }
}
