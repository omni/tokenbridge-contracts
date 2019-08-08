pragma solidity 0.4.24;

import "./Upgradeable.sol";
import "./Initializable.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "openzeppelin-solidity/contracts/AddressUtils.sol";
import "./Validatable.sol";
import "./Ownable.sol";
import "./Claimable.sol";

contract BasicBridge is Initializable, Validatable, Ownable, Upgradeable, Claimable {
    using SafeMath for uint256;

    event GasPriceChanged(uint256 gasPrice);
    event RequiredBlockConfirmationChanged(uint256 requiredBlockConfirmations);

    bytes32 internal constant GAS_PRICE = keccak256(abi.encodePacked("gasPrice"));
    bytes32 internal constant REQUIRED_BLOCK_CONFIRMATIONS = keccak256(abi.encodePacked("requiredBlockConfirmations"));

    function getBridgeInterfacesVersion() external pure returns (uint64 major, uint64 minor, uint64 patch) {
        return (2, 3, 0);
    }

    function setGasPrice(uint256 _gasPrice) external onlyOwner {
        require(_gasPrice > 0);
        uintStorage[GAS_PRICE] = _gasPrice;
        emit GasPriceChanged(_gasPrice);
    }

    function gasPrice() external view returns (uint256) {
        return uintStorage[GAS_PRICE];
    }

    function setRequiredBlockConfirmations(uint256 _blockConfirmations) external onlyOwner {
        require(_blockConfirmations > 0);
        uintStorage[REQUIRED_BLOCK_CONFIRMATIONS] = _blockConfirmations;
        emit RequiredBlockConfirmationChanged(_blockConfirmations);
    }

    function requiredBlockConfirmations() external view returns (uint256) {
        return uintStorage[REQUIRED_BLOCK_CONFIRMATIONS];
    }

    function claimTokens(address _token, address _to) public onlyIfUpgradeabilityOwner validAddress(_to) {
        claimValues(_token, _to);
    }
}
