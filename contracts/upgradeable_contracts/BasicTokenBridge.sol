pragma solidity 0.4.24;

import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "openzeppelin-solidity/contracts/AddressUtils.sol";
import "../upgradeability/EternalStorage.sol";
import "./Ownable.sol";

contract BasicTokenBridge is EternalStorage, Ownable {
    using SafeMath for uint256;

    bytes32 internal constant DECIMAL_SHIFT = 0x1e8ecaafaddea96ed9ac6d2642dcdfe1bebe58a930b1085842d8fc122b371ee5; // keccak256(abi.encodePacked("decimalShift"))
    bytes32 internal constant LIMITS_CONTRACT = 0xa31e93f7d43dce967fc79ad66bd710eaf96d9f4737de61bb298c289276986887; // keccak256(abi.encodePacked("limitsContract"))

    bytes4 internal constant GET_MAX_PER_TX = 0xf968adbe; // maxPerTx()
    bytes4 internal constant GET_MIN_PER_TX = 0xdf25f3f0; // minPerTx()
    bytes4 internal constant GET_DAILY_LIMIT = 0x56ee0405; // dailyLimit(uint256)
    bytes4 internal constant GET_EXECUTION_MAX_PER_TX = 0x8aa1949a; // executionMaxPerTx()
    bytes4 internal constant GET_EXECUTION_MIN_PER_TX = 0x35b00293; // executionMinPerTx()
    bytes4 internal constant GET_EXECUTION_DAILY_LIMIT = 0x5cd79c3a; // executionDailyLimit(uint256)
    bytes4 internal constant GET_TARGET_LIMIT = 0xa70021f3; // targetLimit()
    bytes4 internal constant GET_THRESHOLD = 0x42cde4e8; // threshold()
    bytes4 internal constant GET_WITHIN_LIMIT = 0x894d5ea8; // withinLimit(uint256,uint256)
    bytes4 internal constant GET_WITHIN_EXECUTION_LIMIT = 0x84e43616; // withinExecutionLimit(uint256,uint256)
    bytes4 internal constant GET_TOTAL_SPENT_PER_DAY = 0x2bd0bb05; // totalSpentPerDay(uint256)
    bytes4 internal constant GET_TOTAL_EXECUTED_PER_DAY = 0x4fb3fef7; // totalExecutedPerDay(uint256)
    bytes4 internal constant GET_CURRENT_DAY = 0x3e6968b6; // getCurrentDay()
    bytes4 internal constant INCREASE_TOTAL_SPENT_PER_DAY = 0xb47584cd; // increaseTotalSpentPerDay(uint256)
    bytes4 internal constant INCREASE_TOTAL_EXECUTED_PER_DAY = 0x79d9623a; // increaseTotalExecutedPerDay(uint256)
    bytes4 internal constant SET_LIMITS = 0x1558bff0; // setLimits(uint256[],uint256[])
    bytes4 internal constant SET_MAX_PER_TX = 0xc6f6f216; // setMaxPerTx(uint256)
    bytes4 internal constant SET_MIN_PER_TX = 0xa2a6ca27; // setMinPerTx(uint256)
    bytes4 internal constant SET_DAILY_LIMIT = 0xb20d30a9; // setDailyLimit(uint256)
    bytes4 internal constant SET_EXECUTION_MAX_PER_TX = 0xf20151e1; // setExecutionMaxPerTx(uint256)
    bytes4 internal constant SET_EXECUTION_MIN_PER_TX = 0xf56d2fec; // setExecutionMinPerTx(uint256)
    bytes4 internal constant SET_EXECUTION_DAILY_LIMIT = 0x3dd95d1b; // setExecutionDailyLimit(uint256)
    bytes4 internal constant SET_TARGET_LIMIT = 0x8253a36a; // setTargetLimit(uint256)
    bytes4 internal constant SET_THRESHOLD = 0x960bfe04; // setThreshold(uint256)
    bytes4 internal constant UPDATE_TODAY_LIMIT = 0x0097eff6; // updateTodayLimit(uint256)

    function setLimitsContract(address _limitsContract) external onlyOwner {
        require(AddressUtils.isContract(_limitsContract));
        addressStorage[LIMITS_CONTRACT] = _limitsContract;
    }

    function setLimits(uint256[] _requestLimitsArray, uint256[] _executionLimitsArray) public onlyOwner {
        require(limitsContract().delegatecall(abi.encodeWithSelector(SET_LIMITS, _requestLimitsArray, _executionLimitsArray)));
    }

    function setMaxPerTx(uint256 _maxPerTx) external onlyOwner {
        _execute(SET_MAX_PER_TX, _maxPerTx);
    }

    function setMinPerTx(uint256 _minPerTx) external onlyOwner {
        _execute(SET_MIN_PER_TX, _minPerTx);
    }

    function setDailyLimit(uint256 _dailyLimit) external onlyOwner {
        _execute(SET_DAILY_LIMIT, _dailyLimit);
    }

    function setExecutionMaxPerTx(uint256 _maxPerTx) external onlyOwner {
        _execute(SET_EXECUTION_MAX_PER_TX, _maxPerTx);
    }

    function setExecutionMinPerTx(uint256 _minPerTx) external onlyOwner {
        _execute(SET_EXECUTION_MIN_PER_TX, _minPerTx);
    }

    function setExecutionDailyLimit(uint256 _dailyLimit) external onlyOwner {
        _execute(SET_EXECUTION_DAILY_LIMIT, _dailyLimit);
    }

    function setTargetLimit(uint256 _targetLimit) external onlyOwner {
        _execute(SET_TARGET_LIMIT, _targetLimit);
    }

    function setThreshold(uint256 _threshold) external onlyOwner {
        _execute(SET_THRESHOLD, _threshold);
    }

    function limitsContract() public view returns (address) {
        return addressStorage[LIMITS_CONTRACT];
    }

    function decimalShift() public view returns (uint256) {
        return uintStorage[DECIMAL_SHIFT];
    }

    function maxPerTx() public view returns (uint256) {
        return _getUint(GET_MAX_PER_TX);
    }

    function minPerTx() public view returns (uint256) {
        return _getUint(GET_MIN_PER_TX);
    }

    function dailyLimit() public view returns (uint256) {
        return _getUint(GET_DAILY_LIMIT, _getTokenBalance());
    }

    function executionMaxPerTx() public view returns (uint256) {
        return _getUint(GET_EXECUTION_MAX_PER_TX);
    }

    function executionMinPerTx() public view returns (uint256) {
        return _getUint(GET_EXECUTION_MIN_PER_TX);
    }

    function executionDailyLimit() public view returns (uint256) {
        return _getUint(GET_EXECUTION_DAILY_LIMIT, _getTokenBalance());
    }

    function targetLimit() public view returns (uint256) {
        return _getUint(GET_TARGET_LIMIT);
    }

    function threshold() public view returns (uint256) {
        return _getUint(GET_THRESHOLD);
    }

    function withinLimit(uint256 _amount) public view returns (bool) {
        return _getWithinLimit(GET_WITHIN_LIMIT, _amount, _getTokenBalance());
    }

    function withinExecutionLimit(uint256 _amount) public view returns (bool) {
        return _getWithinLimit(GET_WITHIN_EXECUTION_LIMIT, _amount, _getTokenBalance());
    }

    function totalSpentPerDay(uint256 _day) public view returns (uint256) {
        return _getUint(GET_TOTAL_SPENT_PER_DAY, _day);
    }

    function totalExecutedPerDay(uint256 _day) public view returns (uint256) {
        return _getUint(GET_TOTAL_EXECUTED_PER_DAY, _day);
    }

    function getCurrentDay() public view returns (uint256) {
        return _getUint(GET_CURRENT_DAY);
    }

    function _increaseTotalSpentPerDay(uint256 _amount) internal {
        _execute(INCREASE_TOTAL_SPENT_PER_DAY, _amount);
    }

    function _increaseTotalExecutedPerDay(uint256 _amount) internal {
        _execute(INCREASE_TOTAL_EXECUTED_PER_DAY, _amount);
    }

    function _updateTodayLimit() internal {
        _execute(UPDATE_TODAY_LIMIT, _getTokenBalance());
    }

    function _execute(bytes4 _method, uint256 _value) internal {
        require(limitsContract().delegatecall(abi.encodeWithSelector(_method, _value)));
    }

    function _getTokenBalance() internal view returns (uint256) {}

    function _getUint(bytes4 _method) internal view returns (uint256) {
        return _getUint(abi.encodeWithSelector(_method));
    }

    function _getUint(bytes4 _method, uint256 _param) internal view returns (uint256) {
        return _getUint(abi.encodeWithSelector(_method, _param));
    }

    function _getUint(bytes memory _calldata) internal view returns (uint256) {
        uint256 value;
        address contractAddress = limitsContract();
        assembly {
            let result := callcode(gas, contractAddress, 0x0, add(_calldata, 0x20), mload(_calldata), 0, 32)
            value := mload(0)

            switch result
                case 0 {
                    revert(0, 0)
                }
        }
        return value;
    }

    function _getWithinLimit(bytes4 _method, uint256 _amount, uint256 _tokenBalance) internal view returns (bool) {
        bool value;
        bytes memory callData = abi.encodeWithSelector(_method, _amount, _tokenBalance);
        address contractAddress = limitsContract();
        assembly {
            let result := callcode(gas, contractAddress, 0x0, add(callData, 0x20), mload(callData), 0, 32)
            value := mload(0)

            switch result
                case 0 {
                    revert(0, 0)
                }
        }
        return value;
    }
}
