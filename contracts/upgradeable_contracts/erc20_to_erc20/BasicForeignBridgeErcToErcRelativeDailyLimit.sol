pragma solidity 0.4.24;

import "./BasicForeignBridgeErcToErc.sol";
import "../RelativeDailyLimit.sol";

contract BasicForeignBridgeErcToErcRelativeDailyLimit is BasicForeignBridgeErcToErc, RelativeDailyLimit {
    function _getTokenBalance() internal view returns (uint256) {
        return erc20token().balanceOf(address(this));
    }
}
