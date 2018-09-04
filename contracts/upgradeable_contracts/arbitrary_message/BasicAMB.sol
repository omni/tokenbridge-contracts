pragma solidity 0.4.24;

import "../../upgradeability/EternalStorage.sol";
import "../../libraries/SafeMath.sol";
import "../Validatable.sol";
import "../BasicBridge.sol";


contract BasicAMB is BasicBridge {
    bytes4 constant internal SUBSIDIZED_MODE = bytes4(keccak256("AMB-subsidized-mode"));
    bytes4 constant internal DEFRAYAL_MODE = bytes4(keccak256("AMB-defrayal-mode"));
}

