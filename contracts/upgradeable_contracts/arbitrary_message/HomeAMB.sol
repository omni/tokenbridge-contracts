pragma solidity 0.4.24;

import "./BasicHomeAMB.sol";
import "./BasicForeignAMB.sol";


contract HomeAMB is BasicHomeAMB {
    function initialize() public returns(bool) {
        require(!isInitialized(), "already initialized");
        setDefrayalModeForForeign();
        setInitialize(true);
        return isInitialized();
    }
}
