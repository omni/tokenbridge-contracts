pragma solidity 0.4.24;

import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "./AbsoluteDailyLimit.sol";

contract BasicRelativeDailyLimit is AbsoluteDailyLimit {
    using SafeMath for uint256;

    event TargetLimitChanged(uint256 newLimit);
    event ThresholdChanged(uint256 newThreshold);
    event TodayLimitSet(uint256 limit);

    bytes32 internal constant TARGET_LIMIT = 0x192ac2d88a9de45ce541663ebe1aaf6d6b1d4a6299d3fd0abf2ba7e8b920342b; // keccak256(abi.encodePacked("targetLimit"))
    bytes32 internal constant THRESHOLD = 0xd46c2b20c7303c2e50535d224276492e8a1eda2a3d7398e0bea254640c1154e7; // keccak256(abi.encodePacked("threshold"))

    function _calculateLimit(uint256 _balance) internal view returns (uint256) {
        uint256 unlimitedBalance = _minPerTx();
        if (_balance <= unlimitedBalance) {
            return _balance;
        }
        uint256 limit = targetLimit();
        uint256 thresh = threshold();
        uint256 multiplier = 1 ether**2;
        if (_balance < thresh) {
            // to save the gas we don't need to use safe math here
            // because we check in setters that limit is always less than 1 ether
            // and threshold is greater than minPerTx
            // and minPerTx is less than threshold
            uint256 a = ((1 ether - limit) * multiplier) / (thresh - unlimitedBalance)**2;
            uint256 b = 2 * a * thresh;
            uint256 c = (limit * multiplier) + a * thresh**2;
            limit = (a * _balance**2 - b * _balance + c) / multiplier;
        }
        return (_balance * limit) / 1 ether;
    }

    function targetLimit() public view returns (uint256) {
        return uintStorage[TARGET_LIMIT];
    }

    function threshold() public view returns (uint256) {
        return uintStorage[THRESHOLD];
    }

    function setTargetLimit(uint256 _targetLimit) external {
        require(_targetLimit <= 1 ether);
        uintStorage[TARGET_LIMIT] = _targetLimit;
        emit TargetLimitChanged(_targetLimit);
    }

    function setThreshold(uint256 _threshold) external {
        require(_threshold >= _minPerTx());
        uintStorage[THRESHOLD] = _threshold;
        emit ThresholdChanged(_threshold);
    }

    function updateTodayLimit(uint256 _balance) external payable {
        if (_todayLimit() == 0) {
            uint256 limit = _calculateLimit(_balance);
            _setTodayLimit(limit);
            emit TodayLimitSet(limit);
        }
    }

    function _getTodayLimit(uint256 _tokenBalance) internal view returns (uint256) {
        uint256 limit = _todayLimit();
        if (limit == 0) {
            // not set yet
            limit = _calculateLimit(_tokenBalance);
        }
        return limit;
    }

    function _todayLimit() internal view returns (uint256) {
        return uintStorage[keccak256(abi.encodePacked("todayLimit", getCurrentDay()))];
    }

    function _setTodayLimit(uint256 _value) internal {
        uintStorage[keccak256(abi.encodePacked("todayLimit", getCurrentDay()))] = _value;
    }

    function _minPerTx() internal view returns (uint256);
}
