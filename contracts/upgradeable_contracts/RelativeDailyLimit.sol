pragma solidity 0.4.24;

import "./BaseRelativeDailyLimit.sol";

contract RelativeDailyLimit is BaseRelativeDailyLimit {
    function _minPerTx() internal view returns (uint256) {
        return minPerTx();
    }

    function dailyLimit() public view returns (uint256) {
        return _getTodayLimit();
    }

    function setMinPerTx(uint256 _minPerTx) external onlyOwner {
        require(_minPerTx < maxPerTx());
        uintStorage[MIN_PER_TX] = _minPerTx;
    }

    function setMaxPerTx(uint256 _maxPerTx) external onlyOwner {
        require(_maxPerTx > minPerTx());
        uintStorage[MAX_PER_TX] = _maxPerTx;
    }
}
