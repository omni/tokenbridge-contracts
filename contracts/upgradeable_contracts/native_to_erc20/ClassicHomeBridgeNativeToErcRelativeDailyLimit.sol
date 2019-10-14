pragma solidity 0.4.24;

import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "./ClassicHomeBridgeNativeToErc.sol";
import "../RelativeDailyLimit.sol";

contract ClassicHomeBridgeNativeToErcRelativeDailyLimit is ClassicHomeBridgeNativeToErc {
    function _getTokenBalance() internal view returns (uint256) {
        return address(this).balance;
    }
}
