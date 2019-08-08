pragma solidity 0.4.24;

import "../../upgradeability/EternalStorage.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "openzeppelin-solidity/contracts/AddressUtils.sol";
import "../Validatable.sol";
import "../BasicBridge.sol";

contract BasicAMB is BasicBridge {
    bytes internal constant SUBSIDIZED_MODE = bytes(abi.encodePacked("AMB-subsidized-mode"));
    bytes internal constant DEFRAYAL_MODE = bytes(abi.encodePacked("AMB-defrayal-mode"));
    bytes32 internal constant HOME_TO_FOREIGN_MODE = keccak256(abi.encodePacked("homeToForeignMode"));
    bytes32 internal constant FOREIGN_TO_HOME_MODE = keccak256(abi.encodePacked("foreignToHomeMode"));
    bytes32 internal constant MAX_GAS_PER_TX = keccak256(abi.encodePacked("maxGasPerTx"));

    function initialize(
        address _validatorContract,
        uint256 _maxGasPerTx,
        uint256 _gasPrice,
        uint256 _requiredBlockConfirmations,
        address _owner
    ) public returns (bool) {
        require(!isInitialized());
        require(_validatorContract != address(0) && AddressUtils.isContract(_validatorContract));
        require(_gasPrice > 0);
        require(_requiredBlockConfirmations > 0);
        require(_maxGasPerTx > 0);

        addressStorage[VALIDATOR_CONTRACT] = _validatorContract;
        uintStorage[DEPLOYED_AT_BLOCK] = block.number;
        uintStorage[MAX_GAS_PER_TX] = _maxGasPerTx;
        uintStorage[GAS_PRICE] = _gasPrice;
        uintStorage[REQUIRED_BLOCK_CONFIRMATIONS] = _requiredBlockConfirmations;
        bytesStorage[HOME_TO_FOREIGN_MODE] = DEFRAYAL_MODE;
        bytesStorage[FOREIGN_TO_HOME_MODE] = DEFRAYAL_MODE;
        setOwner(_owner);
        setInitialize();

        emit RequiredBlockConfirmationChanged(_requiredBlockConfirmations);
        emit GasPriceChanged(_gasPrice);

        return isInitialized();
    }

    function getBridgeMode() external pure returns (bytes4 _data) {
        return bytes4(keccak256(abi.encodePacked("arbitrary-message-bridge-core")));
    }

    function setSubsidizedModeForHomeToForeign() external onlyOwner {
        bytesStorage[HOME_TO_FOREIGN_MODE] = SUBSIDIZED_MODE;
    }

    function setDefrayalModeForHomeToForeign() external onlyOwner {
        bytesStorage[HOME_TO_FOREIGN_MODE] = DEFRAYAL_MODE;
    }

    function setSubsidizedModeForForeignToHome() external onlyOwner {
        bytesStorage[FOREIGN_TO_HOME_MODE] = SUBSIDIZED_MODE;
    }

    function setDefrayalModeForForeignToHome() external onlyOwner {
        bytesStorage[FOREIGN_TO_HOME_MODE] = DEFRAYAL_MODE;
    }

    function homeToForeignMode() public view returns (bytes) {
        return bytesStorage[HOME_TO_FOREIGN_MODE];
    }

    function foreignToHomeMode() public view returns (bytes) {
        return bytesStorage[FOREIGN_TO_HOME_MODE];
    }

    function maxGasPerTx() public view returns (uint256) {
        return uintStorage[MAX_GAS_PER_TX];
    }

    function setMaxGasPerTx(uint256 _maxGasPerTx) external onlyOwner {
        require(_maxGasPerTx > 0);
        uintStorage[MAX_GAS_PER_TX] = _maxGasPerTx;
    }
}
