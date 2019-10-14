pragma solidity 0.4.24;

import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "./HomeBridgeErcToNative.sol";
import "../RelativeDailyLimit.sol";

contract HomeBridgeErcToNativeRelativeDailyLimit is HomeBridgeErcToNative, RelativeDailyLimit {
    function _getTokenBalance() internal view returns (uint256) {
        uint256 totalMinted = blockRewardContract().mintedTotallyByBridge(address(this));
        uint256 totalBurnt = totalBurntCoins();
        return totalMinted.sub(totalBurnt);
    }
}
