pragma solidity 0.4.24;

import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "./BasicTokenBridge.sol";

contract RelativeDailyLimit is BasicTokenBridge {
    using SafeMath for uint256;

    event TargetLimitChanged(uint256 newLimit);
    event ThresholdChanged(uint256 newThreshold);

    bytes32 internal constant TARGET_LIMIT = keccak256(abi.encodePacked("targetLimit"));
    bytes32 internal constant THRESHOLD = keccak256(abi.encodePacked("threshold"));

    function dailyLimit() public view returns (uint256) {
        uint256 balance = _getTokenBalance();
        uint256 minBalance = targetLimit().mul(threshold()).div(100);
        uint256 limit;
        if (balance < minBalance) {
            limit = 100;
        } else if (balance >= minBalance && balance < threshold()) {
            limit = targetLimit().mul(threshold()).div(balance);
        } else {
            limit = targetLimit();
        }
        return balance.mul(limit).div(100);
    }

    function targetLimit() public view returns (uint256) {
        return uintStorage[TARGET_LIMIT];
    }

    function threshold() public view returns (uint256) {
        return uintStorage[THRESHOLD];
    }

    function setTargetLimit(uint256 _targetLimit) external onlyOwner {
        uintStorage[TARGET_LIMIT] = _targetLimit;
        emit TargetLimitChanged(_targetLimit);
    }

    function setThreshold(uint256 _threshold) external onlyOwner {
        uintStorage[THRESHOLD] = _threshold;
        emit ThresholdChanged(_threshold);
    }

    function _getTokenBalance() internal view returns (uint256);
}
