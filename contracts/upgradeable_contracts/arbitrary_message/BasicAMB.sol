pragma solidity ^0.4.0;

import "../../upgradeability/EternalStorage.sol";
import "../../libraries/SafeMath.sol";
import "../Validatable.sol";
import "../BasicBridge.sol";

contract BasicAMB is BasicBridge {
    bytes4 constant SUBSIDIZED_MODE = bytes4(keccak256("AMB-subsidized-mode"));
    bytes4 constant DEFRAYAL_MODE = bytes4(keccak256("AMB-defrayal-mode"));
}

