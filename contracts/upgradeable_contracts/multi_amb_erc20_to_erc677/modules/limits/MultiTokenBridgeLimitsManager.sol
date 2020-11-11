pragma solidity 0.4.24;

import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "openzeppelin-solidity/contracts/token/ERC20/DetailedERC20.sol";
import "../MediatorOwnableModule.sol";

/**
 * @title MultiTokenBridgeLimitsManager
 * @dev Manager contract for operations on multi token bridge limits.
 */
contract MultiTokenBridgeLimitsManager is MediatorOwnableModule {
    using SafeMath for uint256;

    // token == 0x00..00 represents default limits (assuming decimals == 18) for all newly created tokens
    event DailyLimitChanged(address indexed token, uint256 newLimit);
    event ExecutionDailyLimitChanged(address indexed token, uint256 newLimit);

    // token => day number => tokens bridged to the other side
    mapping(address => mapping(uint256 => uint256)) public totalSpentPerDay;
    // token => day number => tokens bridged from the other side
    mapping(address => mapping(uint256 => uint256)) public totalExecutedPerDay;
    // token address => daily limit on all deposit operations
    mapping(address => uint256) public dailyLimit;
    // token address => maximum per tx limit on all deposit operations
    mapping(address => uint256) public maxPerTx;
    // token address => minimum per tx limit on all deposit operations
    mapping(address => uint256) public minPerTx;
    // token address => daily limit on all withdraw operations
    mapping(address => uint256) public executionDailyLimit;
    // token address => maximum per tx limit on all withdraw operations
    mapping(address => uint256) public executionMaxPerTx;

    /**
     * @dev Throws if given token address was not used before.
     */
    modifier validTokenAddress(address _token) {
        require(minPerTx[_token] > 0);
        _;
    }

    /**
     * @dev Initializes this contract.
     * @param _mediator address of the mediator contract used together with this manager.
     * @param _owner this contract owner address.
     * @param _dailyLimitMaxPerTxMinPerTxArray array with limit values for the assets to be bridged to the other network.
     *   [ 0 = dailyLimit, 1 = maxPerTx, 2 = minPerTx ]
     * @param _executionDailyLimitExecutionMaxPerTxArray array with limit values for the assets bridged from the other network.
     *   [ 0 = executionDailyLimit, 1 = executionMaxPerTx ]
     */
    constructor(
        address _mediator,
        address _owner,
        uint256[3] _dailyLimitMaxPerTxMinPerTxArray, // [ 0 = _dailyLimit, 1 = _maxPerTx, 2 = _minPerTx ]
        uint256[2] _executionDailyLimitExecutionMaxPerTxArray // [ 0 = _executionDailyLimit, 1 = _executionMaxPerTx ]
    ) public MediatorOwnableModule(_mediator, _owner) {
        _setLimits(address(0), _dailyLimitMaxPerTxMinPerTxArray);
        _setExecutionLimits(address(0), _executionDailyLimitExecutionMaxPerTxArray);
    }

    /**
     * @dev Records deposit operation, updates total spent statistics.
     * Reverts, if transfer is out of limits. Initializes token limits on the first deposit.
     * Can be called only by the mediator contract.
     * @param _token address of the received token.
     * @param _amount amount of tokens received.
     */
    function recordDeposit(address _token, uint256 _amount) external onlyMediator {
        uint256 day = getCurrentDay();
        uint256 updatedTotal = totalSpentPerDay[_token][day].add(_amount);
        if (minPerTx[_token] == 0) {
            _initializeTokenBridgeLimits(_token);
        }
        require(
            dailyLimit[address(0)] > 0 &&
                updatedTotal <= dailyLimit[_token] &&
                _amount <= maxPerTx[_token] &&
                _amount >= minPerTx[_token]
        );
        totalSpentPerDay[_token][day] = updatedTotal;
    }

    /**
     * @dev Records withdraw operation, updates total executed statistics.
     * Reverts, if bridge operation is out of limits. Initializes token limits on the first deposit.
     * Can be called only by the mediator contract.
     * @param _token address of the token withdrawn.
     * @param _amount amount of token withdrawn.
     */
    function recordWithdraw(address _token, uint256 _amount) external onlyMediator {
        uint256 day = getCurrentDay();
        uint256 updatedTotal = totalExecutedPerDay[_token][day].add(_amount);
        if (minPerTx[_token] == 0) {
            _initializeTokenBridgeLimits(_token);
        }
        require(
            executionDailyLimit[address(0)] > 0 &&
                updatedTotal <= executionDailyLimit[_token] &&
                _amount <= executionMaxPerTx[_token]
        );
        totalExecutedPerDay[_token][day] = updatedTotal;
    }

    /**
     * @dev Resets the limits for a particular token, limits will be initialized once again on the next operation.
     * Can be called only by the mediator contract.
     * @param _token address of the token contract for which limits should be deleted.
     */
    function resetLimits(address _token) external onlyMediator {
        delete dailyLimit[_token];
        delete maxPerTx[_token];
        delete minPerTx[_token];
        delete executionDailyLimit[_token];
        delete executionMaxPerTx[_token];
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
    function setDailyLimit(address _token, uint256 _dailyLimit) external onlyOwner validTokenAddress(_token) {
        require(_dailyLimit > maxPerTx[_token] || _dailyLimit == 0);
        dailyLimit[_token] = _dailyLimit;
        emit DailyLimitChanged(_token, _dailyLimit);
    }

    /**
    * @dev Updates execution daily limit for the particular token. Only owner can call this method.
    * @param _token address of the token contract, or address(0) for configuring the default limit.
    * @param _dailyLimit daily allowed amount of executed tokens, should be greater than executionMaxPerTx.
    * 0 value is also allowed, will stop the bridge operations in incoming direction.
    */
    function setExecutionDailyLimit(address _token, uint256 _dailyLimit) external onlyOwner validTokenAddress(_token) {
        require(_dailyLimit > executionMaxPerTx[_token] || _dailyLimit == 0);
        executionDailyLimit[_token] = _dailyLimit;
        emit ExecutionDailyLimitChanged(_token, _dailyLimit);
    }

    /**
    * @dev Updates execution maximum per transaction for the particular token. Only owner can call this method.
    * @param _token address of the token contract, or address(0) for configuring the default limit.
    * @param _maxPerTx maximum amount of executed tokens per one transaction, should be less than executionDailyLimit.
    * 0 value is also allowed, will stop the bridge operations in incoming direction.
    */
    function setExecutionMaxPerTx(address _token, uint256 _maxPerTx) external onlyOwner validTokenAddress(_token) {
        require(_maxPerTx == 0 || _maxPerTx < executionDailyLimit[_token]);
        executionMaxPerTx[_token] = _maxPerTx;
    }

    /**
    * @dev Updates maximum per transaction for the particular token. Only owner can call this method.
    * @param _token address of the token contract, or address(0) for configuring the default limit.
    * @param _maxPerTx maximum amount of tokens per one transaction, should be less than dailyLimit, greater than minPerTx.
    * 0 value is also allowed, will stop the bridge operations in outgoing direction.
    */
    function setMaxPerTx(address _token, uint256 _maxPerTx) external onlyOwner validTokenAddress(_token) {
        require(_maxPerTx == 0 || (_maxPerTx > minPerTx[_token] && _maxPerTx < dailyLimit[_token]));
        maxPerTx[_token] = _maxPerTx;
    }

    /**
    * @dev Updates minumum per transaction for the particular token. Only owner can call this method.
    * @param _token address of the token contract, or address(0) for configuring the default limit.
    * @param _minPerTx minumum amount of tokens per one transaction, should be less than maxPerTx and dailyLimit.
    */
    function setMinPerTx(address _token, uint256 _minPerTx) external onlyOwner validTokenAddress(_token) {
        require(_minPerTx > 0 && _minPerTx < dailyLimit[_token] && _minPerTx < maxPerTx[_token]);
        minPerTx[_token] = _minPerTx;
    }

    /**
    * @dev Retrieves maximum available bridge amount per one transaction taking into account maxPerTx() and dailyLimit() parameters.
    * @param _token address of the token contract, or address(0) for the default limit.
    * @return minimum of maxPerTx parameter and remaining daily quota.
    */
    function maxAvailablePerTx(address _token) public view returns (uint256) {
        uint256 _maxPerTx = maxPerTx[_token];
        uint256 _dailyLimit = dailyLimit[_token];
        uint256 _spent = totalSpentPerDay[_token][getCurrentDay()];
        uint256 _remainingOutOfDaily = _dailyLimit > _spent ? _dailyLimit - _spent : 0;
        return _maxPerTx < _remainingOutOfDaily ? _maxPerTx : _remainingOutOfDaily;
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

        dailyLimit[_token] = _limits[0];
        maxPerTx[_token] = _limits[1];
        minPerTx[_token] = _limits[2];

        emit DailyLimitChanged(_token, _limits[0]);
    }

    /**
    * @dev Internal function for initializing execution limits for some token.
    * @param _token address of the token contract.
    * @param _limits [ 0 = executionDailyLimit, 1 = executionMaxPerTx ].
    */
    function _setExecutionLimits(address _token, uint256[2] _limits) internal {
        require(_limits[1] < _limits[0]); // foreignMaxPerTx < foreignDailyLimit

        executionDailyLimit[_token] = _limits[0];
        executionMaxPerTx[_token] = _limits[1];

        emit ExecutionDailyLimitChanged(_token, _limits[0]);
    }

    /**
    * @dev Internal function for initializing limits for some token relative to its decimals parameter.
    * @param _token address of the token contract.
    */
    function _initializeTokenBridgeLimits(address _token) internal {
        uint256 decimals = uint256(DetailedERC20(_token).decimals());
        uint256 factor;
        if (decimals < 18) {
            factor = 10**(18 - decimals);

            uint256 _minPerTx = minPerTx[address(0)].div(factor);
            uint256 _maxPerTx = maxPerTx[address(0)].div(factor);
            uint256 _dailyLimit = dailyLimit[address(0)].div(factor);
            uint256 _executionMaxPerTx = executionMaxPerTx[address(0)].div(factor);
            uint256 _executionDailyLimit = executionDailyLimit[address(0)].div(factor);

            // such situation can happen when calculated limits relative to the token decimals are too low
            // e.g. minPerTx(address(0)) == 10 ** 14, _decimals == 3. _minPerTx happens to be 0, which is not allowed.
            // in this case, limits are raised to the default values
            if (_minPerTx == 0) {
                // Numbers 1, 100, 10000 are chosen in a semi-random way,
                // so that any token with small decimals can still be bridged in some amounts.
                // It is possible to override limits for the particular token later if needed.
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
            factor = 10**(decimals - 18);
            _setLimits(
                _token,
                [dailyLimit[address(0)].mul(factor), maxPerTx[address(0)].mul(factor), minPerTx[address(0)].mul(factor)]
            );
            _setExecutionLimits(
                _token,
                [executionDailyLimit[address(0)].mul(factor), executionMaxPerTx[address(0)].mul(factor)]
            );
        }
    }
}
