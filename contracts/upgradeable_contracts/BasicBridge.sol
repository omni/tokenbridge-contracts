pragma solidity 0.4.24;

import "./Upgradeable.sol";
import "../upgradeability/EternalStorage.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "./Validatable.sol";
import "./Ownable.sol";
import "./Claimable.sol";


contract BasicBridge is EternalStorage, Validatable, Ownable, Upgradeable, Claimable {
    using SafeMath for uint256;

    event GasPriceChanged(uint256 gasPrice);
    event RequiredBlockConfirmationChanged(uint256 requiredBlockConfirmations);

    function getBridgeInterfacesVersion() external pure returns(uint64 major, uint64 minor, uint64 patch) {
        return (2, 2, 0);
    }

    function setGasPrice(uint256 _gasPrice) external onlyOwner {
        require(_gasPrice > 0);
        uintStorage[keccak256(abi.encodePacked("gasPrice"))] = _gasPrice;
        emit GasPriceChanged(_gasPrice);
    }

    function gasPrice() external view returns(uint256) {
        return uintStorage[keccak256(abi.encodePacked("gasPrice"))];
    }

    function setRequiredBlockConfirmations(uint256 _blockConfirmations) external onlyOwner {
        require(_blockConfirmations > 0);
        uintStorage[keccak256(abi.encodePacked("requiredBlockConfirmations"))] = _blockConfirmations;
        emit RequiredBlockConfirmationChanged(_blockConfirmations);
    }

    function requiredBlockConfirmations() external view returns(uint256) {
        return uintStorage[keccak256(abi.encodePacked("requiredBlockConfirmations"))];
    }

    function deployedAtBlock() external view returns(uint256) {
        return uintStorage[keccak256(abi.encodePacked("deployedAtBlock"))];
    }

    function setInitialize() internal {
        boolStorage[keccak256(abi.encodePacked("isInitialized"))] = true;
    }

    function isInitialized() public view returns(bool) {
        return boolStorage[keccak256(abi.encodePacked("isInitialized"))];
    }

    function claimTokens(address _token, address _to) public onlyIfUpgradeabilityOwner validAddress(_to) {
        claimValues(_token, _to);
    }

    function isContract(address _addr) internal view returns (bool)
    {
        uint length;
        assembly { length := extcodesize(_addr) }
        return length > 0;
    }
}
