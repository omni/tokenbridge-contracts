pragma solidity ^0.4.0;

import "./BasicHomeAMB.sol";
import "./BasicForeignAMB.sol";

contract ForeignAMB is BasicForeignAMB {
    function initialize() public returns(bool) {
        require(!isInitialized(), "already initialized");
        setInitialize(true);
        return isInitialized();
    }
}
