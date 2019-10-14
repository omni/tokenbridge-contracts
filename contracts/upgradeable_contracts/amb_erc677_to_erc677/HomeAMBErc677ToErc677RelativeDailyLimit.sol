pragma solidity 0.4.24;

import "./HomeAMBErc677ToErc677.sol";
import "../RelativeDailyLimit.sol";

contract HomeAMBErc677ToErc677RelativeDailyLimit is HomeAMBErc677ToErc677, RelativeDailyLimit {
    function _getTokenBalance() internal view returns (uint256) {
        return erc677token().totalSupply();
    }
}
