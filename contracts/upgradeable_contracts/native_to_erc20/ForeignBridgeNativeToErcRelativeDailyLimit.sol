pragma solidity 0.4.24;

import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "./ForeignBridgeNativeToErc.sol";
import "../RelativeDailyLimit.sol";

contract ForeignBridgeNativeToErcRelativeDailyLimit is ForeignBridgeNativeToErc, RelativeDailyLimit {
    function _getTokenBalance() internal view returns (uint256) {
        return erc677token().totalSupply();
    }
}
