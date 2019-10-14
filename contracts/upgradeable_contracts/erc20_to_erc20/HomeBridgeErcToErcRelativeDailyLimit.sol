pragma solidity 0.4.24;

import "./HomeBridgeErcToErc.sol";
import "../RelativeDailyLimit.sol";

contract HomeBridgeErcToErcRelativeDailyLimit is HomeBridgeErcToErc, RelativeDailyLimit {
    function _getTokenBalance() internal view returns (uint256) {
        return erc677token().totalSupply();
    }
}
