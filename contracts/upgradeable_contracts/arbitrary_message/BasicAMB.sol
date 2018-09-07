pragma solidity 0.4.24;

import "../../upgradeability/EternalStorage.sol";
import "../../libraries/SafeMath.sol";
import "../Validatable.sol";
import "../BasicBridge.sol";


contract BasicAMB is BasicBridge {
    bytes constant internal SUBSIDIZED_MODE = bytes(abi.encodePacked("AMB-subsidized-mode"));
    bytes constant internal DEFRAYAL_MODE = bytes(abi.encodePacked("AMB-defrayal-mode"));

    function initialize(
        address _validatorContract,
        uint256 _dailyLimit,
        uint256 _maxPerTx,
        uint256 _minPerTx,
        uint256 _gasPrice,
        uint256 _requiredBlockConfirmations
    ) public returns(bool) {
        require(!isInitialized());
        require(_validatorContract != address(0));
        require(_gasPrice > 0);
        require(_requiredBlockConfirmations > 0);
        require(_minPerTx >= 0 && _maxPerTx > _minPerTx && _dailyLimit > _maxPerTx);
        addressStorage[keccak256(abi.encodePacked("validatorContract"))] = _validatorContract;
        uintStorage[keccak256(abi.encodePacked("deployedAtBlock"))] = block.number;
        uintStorage[keccak256(abi.encodePacked("dailyLimit"))] = _dailyLimit;
        uintStorage[keccak256(abi.encodePacked("maxPerTx"))] = _maxPerTx;
        uintStorage[keccak256(abi.encodePacked("minPerTx"))] = _minPerTx;
        uintStorage[keccak256(abi.encodePacked("gasPrice"))] = _gasPrice;
        uintStorage[keccak256(abi.encodePacked("requiredBlockConfirmations"))] = _requiredBlockConfirmations;
        setDefrayalModeForHomeToForeign();
        setInitialize(true);
        return isInitialized();
    }

    function setSubsidizedModeForHomeToForeign() public onlyOwner {
        bytesStorage[keccak256(abi.encodePacked("homeToForeignMode"))] = SUBSIDIZED_MODE;
    }

    function setDefrayalModeForHomeToForeign() public onlyOwner {
        bytesStorage[keccak256(abi.encodePacked("homeToForeignMode"))] = DEFRAYAL_MODE;
    }

    function homeToForeignMode() public view returns(bytes) {
        return bytesStorage[keccak256(abi.encodePacked("homeToForeignMode"))];
    }

    function checkAndUpdateGasLimits(uint256 _gas) internal {
        require(withinLimit(_gas));
        setTotalSpentPerDay(getCurrentDay(), totalSpentPerDay(getCurrentDay()).add(_gas));
    }
}

