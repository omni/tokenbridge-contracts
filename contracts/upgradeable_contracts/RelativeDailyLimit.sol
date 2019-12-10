pragma solidity 0.4.24;

import "./BasicRelativeDailyLimit.sol";

contract RelativeDailyLimit is BasicRelativeDailyLimit {
    function _setRequestLimits(
        uint256[] _requestLimitsArray // [ 0 = _targetLimit, 1 = _threshold, 2 = _requestMaxPerTx, 3 = _requestMinPerTx ]
    ) internal {
        require(
            _requestLimitsArray[3] > 0 && // _requestMinPerTx > 0
                _requestLimitsArray[2] > _requestLimitsArray[3] && // _requestMaxPerTx > _requestMinPerTx
                _requestLimitsArray[1] >= _requestLimitsArray[3] && // _threshold >= _requestMinPerTx
                _requestLimitsArray[0] <= 1 ether // _targetLimit <= 1 ether
        );
        uintStorage[TARGET_LIMIT] = _requestLimitsArray[0];
        uintStorage[THRESHOLD] = _requestLimitsArray[1];
        uintStorage[MAX_PER_TX] = _requestLimitsArray[2];
        uintStorage[MIN_PER_TX] = _requestLimitsArray[3];
    }

    function _minPerTx() internal view returns (uint256) {
        return minPerTx();
    }

    function dailyLimit(uint256 _tokenBalance) public view returns (uint256) {
        return _getTodayLimit(_tokenBalance);
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
