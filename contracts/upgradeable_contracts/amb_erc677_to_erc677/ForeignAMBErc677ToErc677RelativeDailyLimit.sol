pragma solidity 0.4.24;

import "./ForeignAMBErc677ToErc677.sol";
import "../RelativeDailyLimit.sol";

contract ForeignAMBErc677ToErc677RelativeDailyLimit is ForeignAMBErc677ToErc677, RelativeDailyLimit {
    function _getTokenBalance() internal view returns (uint256) {
        return erc677token().balanceOf(address(this));
    }
}
