pragma solidity 0.4.24;

import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "./ForeignBridgeErcToNative.sol";
import "../RelativeDailyLimit.sol";

contract ForeignBridgeErcToNativeRelativeDailyLimit is ForeignBridgeErcToNative, RelativeDailyLimit {
    function _getTokenBalance() internal view returns (uint256) {
        return erc20token().balanceOf(address(this));
    }
}
