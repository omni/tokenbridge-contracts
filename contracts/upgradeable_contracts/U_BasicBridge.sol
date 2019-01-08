pragma solidity 0.4.23;
import "../IBridgeValidators.sol";
import "../upgradeability/EternalStorage.sol";
import "./Validatable.sol";
import "./Ownable.sol";


contract BasicBridge is EternalStorage, Validatable, Ownable {
    event GasPriceChanged(uint256 gasPrice);
    event RequiredBlockConfirmationChanged(uint256 requiredBlockConfirmations);

    function setGasPrice(uint256 _gasPrice) public onlyOwner {
        require(_gasPrice > 0);
        uintStorage[keccak256("gasPrice")] = _gasPrice;
        emit GasPriceChanged(_gasPrice);
    }

    function gasPrice() public view returns(uint256) {
        return uintStorage[keccak256("gasPrice")];
    }

    function setRequiredBlockConfirmations(uint256 _blockConfirmations) public onlyOwner {
        require(_blockConfirmations > 0);
        uintStorage[keccak256("requiredBlockConfirmations")] = _blockConfirmations;
        emit RequiredBlockConfirmationChanged(_blockConfirmations);
    }

    function requiredBlockConfirmations() public view returns(uint256) {
        return uintStorage[keccak256("requiredBlockConfirmations")];
    }
}
