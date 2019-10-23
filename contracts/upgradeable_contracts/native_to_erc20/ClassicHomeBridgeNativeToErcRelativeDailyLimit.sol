pragma solidity 0.4.24;

import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "./ClassicHomeBridgeNativeToErc.sol";
import "../RelativeExecutionDailyLimit.sol";

contract ClassicHomeBridgeNativeToErcRelativeDailyLimit is ClassicHomeBridgeNativeToErc, RelativeExecutionDailyLimit {
    function _getTokenBalance() internal view returns (uint256) {
        return address(this).balance;
    }
}
