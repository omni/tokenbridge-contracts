pragma solidity 0.4.24;

import "./BasicRelativeDailyLimit.sol";

contract RelativeDailyLimit is BasicRelativeDailyLimit {
    function _minPerTx() internal view returns (uint256) {
        return minPerTx();
    }

    function dailyLimit() public view returns (uint256) {
        return _getTodayLimit();
    }

    function setMinPerTx(uint256 _minPerTx) external {
        require(_minPerTx < maxPerTx());
        uintStorage[MIN_PER_TX] = _minPerTx;
    }

    function setMaxPerTx(uint256 _maxPerTx) external {
        require(_maxPerTx > minPerTx() || _maxPerTx == 0);
        uintStorage[MAX_PER_TX] = _maxPerTx;
    }
}
