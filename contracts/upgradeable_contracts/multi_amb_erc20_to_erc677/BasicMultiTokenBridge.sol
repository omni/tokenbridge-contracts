pragma solidity 0.4.24;

import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "../../upgradeability/EternalStorage.sol";
import "../Ownable.sol";

contract BasicMultiTokenBridge is EternalStorage, Ownable {
    using SafeMath for uint256;

    // token == 0x00..00 represents default limits (assuming decimals == 18) for all newly created tokens
    event DailyLimitChanged(address indexed token, uint256 newLimit);
    event ExecutionDailyLimitChanged(address indexed token, uint256 newLimit);

    /**
    * @dev Checks if specified token was already bridged at least once.
    * @param _token address of the token contract.
    * @return true, if token address is address(0) or token was already bridged.
    */
    function isTokenRegistered(address _token) public view returns (bool) {
        return minPerTx(_token) > 0;
    }

    /**
    * @dev Retrieves the total spent amount for particular token during specific day.
    * @param _token address of the token contract.
    * @param _day day number for which spent amount if requested.
    * @return amount of tokens sent through the bridge to the other side.
    */
    function totalSpentPerDay(address _token, uint256 _day) public view returns (uint256) {
        return uintStorage[keccak256(abi.encodePacked("totalSpentPerDay", _token, _day))];
    }

    /**
    * @dev Retrieves the total executed amount for particular token during specific day.
    * @param _token address of the token contract.
    * @param _day day number for which spent amount if requested.
    * @return amount of tokens received from the bridge from the other side.
    */
    function totalExecutedPerDay(address _token, uint256 _day) public view returns (uint256) {
        return uintStorage[keccak256(abi.encodePacked("totalExecutedPerDay", _token, _day))];
    }

    /**
    * @dev Retrieves current daily limit for a particular token contract.
    * @param _token address of the token contract.
    * @return daily limit on tokens that can be sent through the bridge per day.
    */
    function dailyLimit(address _token) public view returns (uint256) {
        return uintStorage[keccak256(abi.encodePacked("dailyLimit", _token))];
    }

    /**
    * @dev Retrieves current execution daily limit for a particular token contract.
    * @param _token address of the token contract.
    * @return daily limit on tokens that can be received from the bridge on the other side per day.
    */
    function executionDailyLimit(address _token) public view returns (uint256) {
        return uintStorage[keccak256(abi.encodePacked("executionDailyLimit", _token))];
    }

    /**
    * @dev Retrieves current maximum amount of tokens per one transfer for a particular token contract.
    * @param _token address of the token contract.
    * @return maximum amount on tokens that can be sent through the bridge in one transfer.
    */
    function maxPerTx(address _token) public view returns (uint256) {
        return uintStorage[keccak256(abi.encodePacked("maxPerTx", _token))];
    }

    /**
    * @dev Retrieves current maximum execution amount of tokens per one transfer for a particular token contract.
    * @param _token address of the token contract.
    * @return maximum amount on tokens that can received from the bridge on the other side in one transaction.
    */
    function executionMaxPerTx(address _token) public view returns (uint256) {
        return uintStorage[keccak256(abi.encodePacked("executionMaxPerTx", _token))];
    }

    /**
    * @dev Retrieves current minimum amount of tokens per one transfer for a particular token contract.
    * @param _token address of the token contract.
    * @return minimum amount on tokens that can be sent through the bridge in one transfer.
    */
    function minPerTx(address _token) public view returns (uint256) {
        return uintStorage[keccak256(abi.encodePacked("minPerTx", _token))];
    }

    /**
    * @dev Checks that bridged amount of tokens conforms to the configured limits.
    * @param _token address of the token contract.
    * @param _amount amount of bridge tokens.
    * @return true, if specified amount can be bridged.
    */
    function withinLimit(address _token, uint256 _amount) public view returns (bool) {
        uint256 nextLimit = totalSpentPerDay(_token, getCurrentDay()).add(_amount);
        return
            dailyLimit(address(0)) > 0 &&
                dailyLimit(_token) >= nextLimit &&
                _amount <= maxPerTx(_token) &&
                _amount >= minPerTx(_token);
    }

    /**
    * @dev Checks that bridged amount of tokens conforms to the configured execution limits.
    * @param _token address of the token contract.
    * @param _amount amount of bridge tokens.
    * @return true, if specified amount can be processed and executed.
    */
    function withinExecutionLimit(address _token, uint256 _amount) public view returns (bool) {
        uint256 nextLimit = totalExecutedPerDay(_token, getCurrentDay()).add(_amount);
        return
            executionDailyLimit(address(0)) > 0 &&
                executionDailyLimit(_token) >= nextLimit &&
                _amount <= executionMaxPerTx(_token);
    }

    /**
    * @dev Returns current day number.
    * @return day number.
    */
    function getCurrentDay() public view returns (uint256) {
        // solhint-disable-next-line not-rely-on-time
        return now / 1 days;
    }

    /**
    * @dev Updates daily limit for the particular token. Only owner can call this method.
    * @param _token address of the token contract, or address(0) for configuring the efault limit.
    * @param _dailyLimit daily allowed amount of bridged tokens, should be greater than maxPerTx.
    * 0 value is also allowed, will stop the bridge operations in outgoing direction.
    */
    function setDailyLimit(address _token, uint256 _dailyLimit) external onlyOwner {
        require(isTokenRegistered(_token));
        require(_dailyLimit > maxPerTx(_token) || _dailyLimit == 0);
        uintStorage[keccak256(abi.encodePacked("dailyLimit", _token))] = _dailyLimit;
        emit DailyLimitChanged(_token, _dailyLimit);
    }

    /**
    * @dev Updates execution daily limit for the particular token. Only owner can call this method.
    * @param _token address of the token contract, or address(0) for configuring the default limit.
    * @param _dailyLimit daily allowed amount of executed tokens, should be greater than executionMaxPerTx.
    * 0 value is also allowed, will stop the bridge operations in incoming direction.
    */
    function setExecutionDailyLimit(address _token, uint256 _dailyLimit) external onlyOwner {
        require(isTokenRegistered(_token));
        require(_dailyLimit > executionMaxPerTx(_token) || _dailyLimit == 0);
        uintStorage[keccak256(abi.encodePacked("executionDailyLimit", _token))] = _dailyLimit;
        emit ExecutionDailyLimitChanged(_token, _dailyLimit);
    }

    /**
    * @dev Updates execution maximum per transaction for the particular token. Only owner can call this method.
    * @param _token address of the token contract, or address(0) for configuring the default limit.
    * @param _maxPerTx maximum amount of executed tokens per one transaction, should be less than executionDailyLimit.
    * 0 value is also allowed, will stop the bridge operations in incoming direction.
    */
    function setExecutionMaxPerTx(address _token, uint256 _maxPerTx) external onlyOwner {
        require(isTokenRegistered(_token));
        require(_maxPerTx == 0 || (_maxPerTx > 0 && _maxPerTx < executionDailyLimit(_token)));
        uintStorage[keccak256(abi.encodePacked("executionMaxPerTx", _token))] = _maxPerTx;
    }

    /**
    * @dev Updates maximum per transaction for the particular token. Only owner can call this method.
    * @param _token address of the token contract, or address(0) for configuring the default limit.
    * @param _maxPerTx maximum amount of tokens per one transaction, should be less than dailyLimit, greater than minPerTx.
    * 0 value is also allowed, will stop the bridge operations in outgoing direction.
    */
    function setMaxPerTx(address _token, uint256 _maxPerTx) external onlyOwner {
        require(isTokenRegistered(_token));
        require(_maxPerTx == 0 || (_maxPerTx > minPerTx(_token) && _maxPerTx < dailyLimit(_token)));
        uintStorage[keccak256(abi.encodePacked("maxPerTx", _token))] = _maxPerTx;
    }

    /**
    * @dev Updates minumum per transaction for the particular token. Only owner can call this method.
    * @param _token address of the token contract, or address(0) for configuring the default limit.
    * @param _minPerTx minumum amount of tokens per one transaction, should be less than maxPerTx and dailyLimit.
    */
    function setMinPerTx(address _token, uint256 _minPerTx) external onlyOwner {
        require(isTokenRegistered(_token));
        require(_minPerTx > 0 && _minPerTx < dailyLimit(_token) && _minPerTx < maxPerTx(_token));
        uintStorage[keccak256(abi.encodePacked("minPerTx", _token))] = _minPerTx;
    }

    /**
    * @dev Retrieves maximum available bridge amount per one transaction taking into account maxPerTx() and dailyLimit() parameters.
    * @param _token address of the token contract, or address(0) for the default limit.
    * @return minimum of maxPerTx parameter and remaining daily quota.
    */
    function maxAvailablePerTx(address _token) public view returns (uint256) {
        uint256 _maxPerTx = maxPerTx(_token);
        uint256 _dailyLimit = dailyLimit(_token);
        uint256 _spent = totalSpentPerDay(_token, getCurrentDay());
        uint256 _remainingOutOfDaily = _dailyLimit > _spent ? _dailyLimit - _spent : 0;
        return _maxPerTx < _remainingOutOfDaily ? _maxPerTx : _remainingOutOfDaily;
    }

    /**
    * @dev Internal function for adding spent amount for some token.
    * @param _token address of the token contract.
    * @param _day day number, when tokens are processed.
    * @param _value amount of bridge tokens.
    */
    function addTotalSpentPerDay(address _token, uint256 _day, uint256 _value) internal {
        uintStorage[keccak256(abi.encodePacked("totalSpentPerDay", _token, _day))] = totalSpentPerDay(_token, _day).add(
            _value
        );
    }

    /**
    * @dev Internal function for adding execcuted amount for some token.
    * @param _token address of the token contract.
    * @param _day day number, when tokens are processed.
    * @param _value amount of bridge tokens.
    */
    function addTotalExecutedPerDay(address _token, uint256 _day, uint256 _value) internal {
        uintStorage[keccak256(abi.encodePacked("totalExecutedPerDay", _token, _day))] = totalExecutedPerDay(
            _token,
            _day
        )
            .add(_value);
    }

    /**
    * @dev Internal function for initializing limits for some token.
    * @param _token address of the token contract.
    * @param _limits [ 0 = dailyLimit, 1 = maxPerTx, 2 = minPerTx ].
    */
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

    /**
    * @dev Internal function for initializing execution limits for some token.
    * @param _token address of the token contract.
    * @param _limits [ 0 = executionDailyLimit, 1 = executionMaxPerTx ].
    */
    function _setExecutionLimits(address _token, uint256[2] _limits) internal {
        require(_limits[1] < _limits[0]); // foreignMaxPerTx < foreignDailyLimit

        uintStorage[keccak256(abi.encodePacked("executionDailyLimit", _token))] = _limits[0];
        uintStorage[keccak256(abi.encodePacked("executionMaxPerTx", _token))] = _limits[1];

        emit ExecutionDailyLimitChanged(_token, _limits[0]);
    }

    /**
    * @dev Internal function for initializing limits for some token relative to its decimals parameter.
    * @param _token address of the token contract.
    * @param _decimals token decimals parameter.
    */
    function _initializeTokenBridgeLimits(address _token, uint256 _decimals) internal {
        uint256 factor;
        if (_decimals < 18) {
            factor = 10**(18 - _decimals);

            uint256 _minPerTx = minPerTx(address(0)).div(factor);
            uint256 _maxPerTx = maxPerTx(address(0)).div(factor);
            uint256 _dailyLimit = dailyLimit(address(0)).div(factor);
            uint256 _executionMaxPerTx = executionMaxPerTx(address(0)).div(factor);
            uint256 _executionDailyLimit = executionDailyLimit(address(0)).div(factor);

            // such situation can happen when calculated limits relative to the token decimals are too low
            // e.g. minPerTx(address(0)) == 10 ** 14, _decimals == 3. _minPerTx happens to be 0, which is not allowed.
            // in this case, limits are raised to the default values
            if (_minPerTx == 0) {
                _minPerTx = 1;
                if (_maxPerTx <= _minPerTx) {
                    _maxPerTx = 100;
                    _executionMaxPerTx = 100;
                    if (_dailyLimit <= _maxPerTx || _executionDailyLimit <= _executionMaxPerTx) {
                        _dailyLimit = 10000;
                        _executionDailyLimit = 10000;
                    }
                }
            }
            _setLimits(_token, [_dailyLimit, _maxPerTx, _minPerTx]);
            _setExecutionLimits(_token, [_executionDailyLimit, _executionMaxPerTx]);
        } else {
            factor = 10**(_decimals - 18);
            _setLimits(
                _token,
                [dailyLimit(address(0)).mul(factor), maxPerTx(address(0)).mul(factor), minPerTx(address(0)).mul(factor)]
            );
            _setExecutionLimits(
                _token,
                [executionDailyLimit(address(0)).mul(factor), executionMaxPerTx(address(0)).mul(factor)]
            );
        }
    }
}
