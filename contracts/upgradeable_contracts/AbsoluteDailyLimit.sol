pragma solidity 0.4.24;

import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "../upgradeability/EternalStorage.sol";

contract AbsoluteDailyLimit is EternalStorage {
    using SafeMath for uint256;

    event DailyLimitChanged(uint256 newLimit);
    event ExecutionDailyLimitChanged(uint256 newLimit);

    bytes32 internal constant MIN_PER_TX = 0xbbb088c505d18e049d114c7c91f11724e69c55ad6c5397e2b929e68b41fa05d1; // keccak256(abi.encodePacked("minPerTx"))
    bytes32 internal constant MAX_PER_TX = 0x0f8803acad17c63ee38bf2de71e1888bc7a079a6f73658e274b08018bea4e29c; // keccak256(abi.encodePacked("maxPerTx"))
    bytes32 internal constant DAILY_LIMIT = 0x4a6a899679f26b73530d8cf1001e83b6f7702e04b6fdb98f3c62dc7e47e041a5; // keccak256(abi.encodePacked("dailyLimit"))
    bytes32 internal constant EXECUTION_MIN_PER_TX = 0x0fc9356d7bc6ba08bb648a3ab811cf6e7c168745644ba25095b79e4d8a0c65ec; // keccak256(abi.encodePacked("executionMinPerTx"))
    bytes32 internal constant EXECUTION_MAX_PER_TX = 0xc0ed44c192c86d1cc1ba51340b032c2766b4a2b0041031de13c46dd7104888d5; // keccak256(abi.encodePacked("executionMaxPerTx"))
    bytes32 internal constant EXECUTION_DAILY_LIMIT = 0x21dbcab260e413c20dc13c28b7db95e2b423d1135f42bb8b7d5214a92270d237; // keccak256(abi.encodePacked("executionDailyLimit"))

    function setLimits(uint256[] _requestLimitsArray, uint256[] _executionLimitsArray) external {
        _setRequestLimits(_requestLimitsArray);
        _setExecutionLimits(_executionLimitsArray);
    }

    function _setRequestLimits(
        uint256[] _requestLimitsArray // [ 0 = _requestDailyLimit, 1 = _requestMaxPerTx, 2 = _requestMinPerTx ]
    ) internal {
        require(
            _requestLimitsArray[2] > 0 && // _requestMinPerTx > 0
                _requestLimitsArray[1] > _requestLimitsArray[2] && // _requestMaxPerTx > _requestMinPerTx
                _requestLimitsArray[0] > _requestLimitsArray[1] // _requestDailyLimit > _requestMaxPerTx
        );
        uintStorage[DAILY_LIMIT] = _requestLimitsArray[0];
        uintStorage[MAX_PER_TX] = _requestLimitsArray[1];
        uintStorage[MIN_PER_TX] = _requestLimitsArray[2];
        emit DailyLimitChanged(_requestLimitsArray[0]);
    }

    function _setExecutionLimits(
        uint256[] _executionLimitsArray // [ 0 = _executionDailyLimit, 1 = _executionMaxPerTx, 2 = _executionMinPerTx ]
    ) internal {
        require(
            _executionLimitsArray[2] > 0 && // _foreignMinPerTx > 0
                _executionLimitsArray[1] > _executionLimitsArray[2] && // _foreignMaxPerTx > _foreignMinPerTx
                _executionLimitsArray[0] > _executionLimitsArray[1] // _foreignDailyLimit > _foreignMaxPerTx
        );
        uintStorage[EXECUTION_DAILY_LIMIT] = _executionLimitsArray[0];
        uintStorage[EXECUTION_MAX_PER_TX] = _executionLimitsArray[1];
        uintStorage[EXECUTION_MIN_PER_TX] = _executionLimitsArray[2];
        emit ExecutionDailyLimitChanged(_executionLimitsArray[0]);
    }

    function totalSpentPerDay(uint256 _day) public view returns (uint256) {
        return uintStorage[keccak256(abi.encodePacked("totalSpentPerDay", _day))];
    }

    function totalExecutedPerDay(uint256 _day) public view returns (uint256) {
        return uintStorage[keccak256(abi.encodePacked("totalExecutedPerDay", _day))];
    }

    function dailyLimit(uint256) public view returns (uint256) {
        return uintStorage[DAILY_LIMIT];
    }

    function executionDailyLimit(uint256) public view returns (uint256) {
        return uintStorage[EXECUTION_DAILY_LIMIT];
    }

    function maxPerTx() public view returns (uint256) {
        return uintStorage[MAX_PER_TX];
    }

    function executionMaxPerTx() public view returns (uint256) {
        return uintStorage[EXECUTION_MAX_PER_TX];
    }

    function minPerTx() public view returns (uint256) {
        return uintStorage[MIN_PER_TX];
    }

    function executionMinPerTx() public view returns (uint256) {
        return uintStorage[EXECUTION_MIN_PER_TX];
    }

    function withinLimit(uint256 _amount, uint256 _tokenBalance) external view returns (bool) {
        uint256 nextLimit = totalSpentPerDay(getCurrentDay()).add(_amount);
        return dailyLimit(_tokenBalance) >= nextLimit && _amount <= maxPerTx() && _amount >= minPerTx();
    }

    function withinExecutionLimit(uint256 _amount, uint256 _tokenBalance) external view returns (bool) {
        uint256 nextLimit = totalExecutedPerDay(getCurrentDay()).add(_amount);
        return executionDailyLimit(_tokenBalance) >= nextLimit && _amount <= executionMaxPerTx();
    }

    function getCurrentDay() public view returns (uint256) {
        // solhint-disable-next-line not-rely-on-time
        return now / 1 days;
    }

    function increaseTotalSpentPerDay(uint256 _value) external payable {
        uint256 totalSpent = totalSpentPerDay(getCurrentDay()).add(_value);
        uintStorage[keccak256(abi.encodePacked("totalSpentPerDay", getCurrentDay()))] = totalSpent;
    }

    function increaseTotalExecutedPerDay(uint256 _value) external payable {
        uint256 totalExecuted = totalExecutedPerDay(getCurrentDay()).add(_value);
        uintStorage[keccak256(abi.encodePacked("totalExecutedPerDay", getCurrentDay()))] = totalExecuted;
    }

    function setDailyLimit(uint256 _dailyLimit) external {
        require(_dailyLimit > maxPerTx() || _dailyLimit == 0);
        uintStorage[DAILY_LIMIT] = _dailyLimit;
        emit DailyLimitChanged(_dailyLimit);
    }

    function setExecutionDailyLimit(uint256 _dailyLimit) external {
        require(_dailyLimit > executionMaxPerTx() || _dailyLimit == 0);
        uintStorage[EXECUTION_DAILY_LIMIT] = _dailyLimit;
        emit ExecutionDailyLimitChanged(_dailyLimit);
    }

    function setExecutionMaxPerTx(uint256 _maxPerTx) external {
        require(_maxPerTx < executionDailyLimit(0));
        uintStorage[EXECUTION_MAX_PER_TX] = _maxPerTx;
    }

    function setExecutionMinPerTx(uint256 _minPerTx) external {
        require(_minPerTx < executionDailyLimit(0) && _minPerTx < executionMaxPerTx());
        uintStorage[EXECUTION_MIN_PER_TX] = _minPerTx;
    }

    function setMaxPerTx(uint256 _maxPerTx) external {
        require(_maxPerTx == 0 || (_maxPerTx > minPerTx() && _maxPerTx < dailyLimit(0)));
        uintStorage[MAX_PER_TX] = _maxPerTx;
    }

    function setMinPerTx(uint256 _minPerTx) external {
        require(_minPerTx > 0 && _minPerTx < dailyLimit(0) && _minPerTx < maxPerTx());
        uintStorage[MIN_PER_TX] = _minPerTx;
    }

    // solhint-disable-next-line no-empty-blocks
    function updateTodayLimit(uint256) external payable {}
}
