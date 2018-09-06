pragma solidity 0.4.24;

import "../../upgradeability/EternalStorage.sol";
import "../../libraries/SafeMath.sol";
import "../Validatable.sol";
import "../BasicBridge.sol";


contract BasicAMB is BasicBridge {
    bytes constant internal SUBSIDIZED_MODE = bytes(abi.encodePacked("AMB-subsidized-mode"));
    bytes constant internal DEFRAYAL_MODE = bytes(abi.encodePacked("AMB-defrayal-mode"));

    function setSubsidizedModeForForeign() public onlyOwner {
        bytesStorage[keccak256(abi.encodePacked("foreignBridgeMode"))] = SUBSIDIZED_MODE;
    }

    function setDefrayalModeForForeign() public onlyOwner {
        bytesStorage[keccak256(abi.encodePacked("foreignBridgeMode"))] = DEFRAYAL_MODE;
    }

    function foreignBridgeMode() public view returns(bytes) {
        return bytesStorage[keccak256(abi.encodePacked("foreignBridgeMode"))];
    }

    function checkAndUpdateGasLimits(uint256 _gas) internal {
        require(withinLimit(_gas), "Estimated Gas is not within limits or daily gas usage limit reached");
        setTotalSpentPerDay(getCurrentDay(), totalSpentPerDay(getCurrentDay()).add(_gas));
    }
}

