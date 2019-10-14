pragma solidity 0.4.24;

import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "./HomeBridgeNativeToErc.sol";
import "../RelativeDailyLimit.sol";

contract HomeBridgeNativeToErcRelativeDailyLimit is HomeBridgeNativeToErc {
    function _getTokenBalance() internal view returns (uint256) {
        return address(this).balance;
    }
}
