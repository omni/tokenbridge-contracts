pragma solidity 0.4.24;

import "./BasicForeignBridgeErcToErc.sol";
import "../RelativeExecutionDailyLimit.sol";

contract BasicForeignBridgeErcToErcRelativeDailyLimit is BasicForeignBridgeErcToErc, RelativeExecutionDailyLimit {
    function executeSignatures(uint8[] vs, bytes32[] rs, bytes32[] ss, bytes message) public {
        _updateTodayLimit();
        super.executeSignatures(vs, rs, ss, message);
    }

    function _getTokenBalance() internal view returns (uint256) {
        return erc20token().balanceOf(address(this));
    }
}
