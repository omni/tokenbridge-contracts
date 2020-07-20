pragma solidity 0.4.24;

import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "../../upgradeability/EternalStorage.sol";
import "../Ownable.sol";

contract BasicMultiTokenBridge is EternalStorage, Ownable {
    using SafeMath for uint256;

    // token == 0x00..00 represents initial limits for all new initialized tokens
    event DailyLimitChanged(address indexed token, uint256 newLimit);
    event ExecutionDailyLimitChanged(address indexed token, uint256 newLimit);

    function totalSpentPerDay(address _token, uint256 _day) public view returns (uint256) {
        return uintStorage[keccak256(abi.encodePacked("totalSpentPerDay", _token, _day))];
    }

    function totalExecutedPerDay(address _token, uint256 _day) public view returns (uint256) {
        return uintStorage[keccak256(abi.encodePacked("totalExecutedPerDay", _token, _day))];
    }

    function dailyLimit(address _token) public view returns (uint256) {
        return uintStorage[keccak256(abi.encodePacked("dailyLimit", _token))];
    }

    function executionDailyLimit(address _token) public view returns (uint256) {
        return uintStorage[keccak256(abi.encodePacked("executionDailyLimit", _token))];
    }

    function maxPerTx(address _token) public view returns (uint256) {
        return uintStorage[keccak256(abi.encodePacked("maxPerTx", _token))];
    }

    function executionMaxPerTx(address _token) public view returns (uint256) {
        return uintStorage[keccak256(abi.encodePacked("executionMaxPerTx", _token))];
    }

    function minPerTx(address _token) public view returns (uint256) {
        return uintStorage[keccak256(abi.encodePacked("minPerTx", _token))];
    }

    function withinLimit(address _token, uint256 _amount) public view returns (bool) {
        uint256 nextLimit = totalSpentPerDay(_token, getCurrentDay()).add(_amount);
        return dailyLimit(_token) >= nextLimit && _amount <= maxPerTx(_token) && _amount >= minPerTx(_token);
    }

    function withinExecutionLimit(address _token, uint256 _amount) public view returns (bool) {
        uint256 nextLimit = totalExecutedPerDay(_token, getCurrentDay()).add(_amount);
        return executionDailyLimit(_token) >= nextLimit && _amount <= executionMaxPerTx(_token);
    }

    function getCurrentDay() public view returns (uint256) {
        // solhint-disable-next-line not-rely-on-time
        return now / 1 days;
    }

    function addTotalSpentPerDay(address _token, uint256 _day, uint256 _value) internal {
        uintStorage[keccak256(abi.encodePacked("totalSpentPerDay", _token, _day))] = totalSpentPerDay(_token, _day).add(
            _value
        );
    }

    function addTotalExecutedPerDay(address _token, uint256 _day, uint256 _value) internal {
        uintStorage[keccak256(abi.encodePacked("totalExecutedPerDay", _token, _day))] = totalExecutedPerDay(
            _token,
            _day
        )
            .add(_value);
    }

    function setDailyLimit(address _token, uint256 _dailyLimit) external onlyOwner {
        require(_dailyLimit > maxPerTx(_token) || _dailyLimit == 0);
        uintStorage[keccak256(abi.encodePacked("dailyLimit", _token))] = _dailyLimit;
        emit DailyLimitChanged(_token, _dailyLimit);
    }

    function setExecutionDailyLimit(address _token, uint256 _dailyLimit) external onlyOwner {
        require(_dailyLimit > executionMaxPerTx(_token) || _dailyLimit == 0);
        uintStorage[keccak256(abi.encodePacked("executionDailyLimit", _token))] = _dailyLimit;
        emit ExecutionDailyLimitChanged(_token, _dailyLimit);
    }

    function setExecutionMaxPerTx(address _token, uint256 _maxPerTx) external onlyOwner {
        require(_maxPerTx < executionDailyLimit(_token));
        uintStorage[keccak256(abi.encodePacked("executionMaxPerTx", _token))] = _maxPerTx;
    }

    function setMaxPerTx(address _token, uint256 _maxPerTx) external onlyOwner {
        require(_maxPerTx == 0 || (_maxPerTx > minPerTx(_token) && _maxPerTx < dailyLimit(_token)));
        uintStorage[keccak256(abi.encodePacked("maxPerTx", _token))] = _maxPerTx;
    }

    function setMinPerTx(address _token, uint256 _minPerTx) external onlyOwner {
        require(_minPerTx > 0 && _minPerTx < dailyLimit(_token) && _minPerTx < maxPerTx(_token));
        uintStorage[keccak256(abi.encodePacked("minPerTx", _token))] = _minPerTx;
    }

    function _setLimits(address _token, uint256[3] _limits) internal {
        require(
            _limits[2] > 0 && // minPerTx > 0
                _limits[1] > _limits[2] && // maxPerTx > minPerTx
                _limits[0] > _limits[1] // dailyLimit > maxPerTx
        );

        uintStorage[keccak256(abi.encodePacked("dailyLimit", _token))] = _limits[0];
        uintStorage[keccak256(abi.encodePacked("maxPerTx", _token))] = _limits[1];
        uintStorage[keccak256(abi.encodePacked("minPerTx", _token))] = _limits[2];

        emit DailyLimitChanged(_token, _limits[0]);
    }

    function _setExecutionLimits(address _token, uint256[2] _limits) internal {
        require(_limits[1] < _limits[0]); // foreignMaxPerTx < foreignDailyLimit

        uintStorage[keccak256(abi.encodePacked("executionDailyLimit", _token))] = _limits[0];
        uintStorage[keccak256(abi.encodePacked("executionMaxPerTx", _token))] = _limits[1];

        emit ExecutionDailyLimitChanged(_token, _limits[0]);
    }

    function _initializeTokenBridgeLimits(address _token, uint256 _decimals) internal {
        uint256 factor;
        if (_decimals <= 18) {
            factor = 10**(18 - _decimals);
            uintStorage[keccak256(abi.encodePacked("dailyLimit", _token))] = dailyLimit(address(0)).div(factor);
            uintStorage[keccak256(abi.encodePacked("maxPerTx", _token))] = maxPerTx(address(0)).div(factor);
            uintStorage[keccak256(abi.encodePacked("minPerTx", _token))] = minPerTx(address(0)).div(factor);
            uintStorage[keccak256(abi.encodePacked("executionDailyLimit", _token))] = executionDailyLimit(address(0))
                .div(factor);
            uintStorage[keccak256(abi.encodePacked("executionMaxPerTx", _token))] = executionMaxPerTx(address(0)).div(
                factor
            );
        } else {
            factor = 10**(_decimals - 18);
            uintStorage[keccak256(abi.encodePacked("dailyLimit", _token))] = dailyLimit(address(0)).mul(factor);
            uintStorage[keccak256(abi.encodePacked("maxPerTx", _token))] = maxPerTx(address(0)).mul(factor);
            uintStorage[keccak256(abi.encodePacked("minPerTx", _token))] = minPerTx(address(0)).mul(factor);
            uintStorage[keccak256(abi.encodePacked("executionDailyLimit", _token))] = executionDailyLimit(address(0))
                .mul(factor);
            uintStorage[keccak256(abi.encodePacked("executionMaxPerTx", _token))] = executionMaxPerTx(address(0)).mul(
                factor
            );
        }
    }
}
