pragma solidity 0.4.24;

import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "./ClassicHomeBridgeNativeToErc.sol";
import "./HomeBridgeNativeToErcRelativeDailyLimit.sol";

contract ClassicHomeBridgeNativeToErcRelativeDailyLimit is
    ClassicHomeBridgeNativeToErc,
    HomeBridgeNativeToErcRelativeDailyLimit
{
    function _getTokenBalance() internal view returns (uint256) {
        return address(this).balance;
    }
}
