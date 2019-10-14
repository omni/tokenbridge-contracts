pragma solidity 0.4.24;

import "./ForeignBridgeNativeToErc.sol";
import "../RelativeDailyLimit.sol";

contract ForeignBridgeNativeToErcRelativeDailyLimit is ForeignBridgeNativeToErc, RelativeDailyLimit {
    function _getTokenBalance() internal view returns (uint256) {
        return erc677token().totalSupply();
    }
}
