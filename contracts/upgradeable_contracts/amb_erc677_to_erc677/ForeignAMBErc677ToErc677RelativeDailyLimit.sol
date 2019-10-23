pragma solidity 0.4.24;

import "./ForeignAMBErc677ToErc677.sol";
import "../RelativeExecutionDailyLimit.sol";

contract ForeignAMBErc677ToErc677RelativeDailyLimit is ForeignAMBErc677ToErc677, RelativeExecutionDailyLimit {
    function _getTokenBalance() internal view returns (uint256) {
        return erc677token().balanceOf(address(this));
    }
}
