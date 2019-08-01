pragma solidity 0.4.24;

import "../interfaces/IBridgeValidators.sol";
import "./Upgradeable.sol";
import "../upgradeability/EternalStorage.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "openzeppelin-solidity/contracts/AddressUtils.sol";
import "./Validatable.sol";
import "./Ownable.sol";
import "./Claimable.sol";

contract BasicBridge is EternalStorage, Validatable, Ownable, Upgradeable, Claimable {
    using SafeMath for uint256;

    event GasPriceChanged(uint256 gasPrice);
    event RequiredBlockConfirmationChanged(uint256 requiredBlockConfirmations);
    event DailyLimitChanged(uint256 previousLimit, uint256 newLimit);
    event ExecutionDailyLimitChanged(uint256 previousLimit, uint256 newLimit);

    function getBridgeInterfacesVersion() external pure returns (uint64 major, uint64 minor, uint64 patch) {
        return (2, 3, 0);
    }

    function setGasPrice(uint256 _gasPrice) external onlyOwner {
        require(_gasPrice > 0);
        uintStorage[keccak256(abi.encodePacked("gasPrice"))] = _gasPrice;
        emit GasPriceChanged(_gasPrice);
    }

    function gasPrice() external view returns (uint256) {
        return uintStorage[keccak256(abi.encodePacked("gasPrice"))];
    }

    function setRequiredBlockConfirmations(uint256 _blockConfirmations) external onlyOwner {
        require(_blockConfirmations > 0);
        uintStorage[keccak256(abi.encodePacked("requiredBlockConfirmations"))] = _blockConfirmations;
        emit RequiredBlockConfirmationChanged(_blockConfirmations);
    }

    function requiredBlockConfirmations() external view returns (uint256) {
        return uintStorage[keccak256(abi.encodePacked("requiredBlockConfirmations"))];
    }

    function deployedAtBlock() external view returns (uint256) {
        return uintStorage[keccak256(abi.encodePacked("deployedAtBlock"))];
    }

    function setTotalSpentPerDay(uint256 _day, uint256 _value) internal {
        uintStorage[keccak256(abi.encodePacked("totalSpentPerDay", _day))] = _value;
    }

    function totalSpentPerDay(uint256 _day) public view returns (uint256) {
        return uintStorage[keccak256(abi.encodePacked("totalSpentPerDay", _day))];
    }

    function setTotalExecutedPerDay(uint256 _day, uint256 _value) internal {
        uintStorage[keccak256(abi.encodePacked("totalExecutedPerDay", _day))] = _value;
    }

    function totalExecutedPerDay(uint256 _day) public view returns (uint256) {
        return uintStorage[keccak256(abi.encodePacked("totalExecutedPerDay", _day))];
    }

    function minPerTx() public view returns (uint256) {
        return uintStorage[keccak256(abi.encodePacked("minPerTx"))];
    }

    function maxPerTx() public view returns (uint256) {
        return uintStorage[keccak256(abi.encodePacked("maxPerTx"))];
    }

    function executionMaxPerTx() public view returns (uint256) {
        return uintStorage[keccak256(abi.encodePacked("executionMaxPerTx"))];
    }

    function setInitialize() internal {
        boolStorage[keccak256(abi.encodePacked("isInitialized"))] = true;
    }

    function isInitialized() public view returns (bool) {
        return boolStorage[keccak256(abi.encodePacked("isInitialized"))];
    }

    function getCurrentDay() public view returns (uint256) {
        // solhint-disable-next-line not-rely-on-time
        return now / 1 days;
    }

    function setDailyLimit(uint256 _dailyLimit) external onlyOwner {
        require(_dailyLimit > maxPerTx() || _dailyLimit == 0);
        emit DailyLimitChanged(dailyLimit(), _dailyLimit);
        uintStorage[keccak256(abi.encodePacked("dailyLimit"))] = _dailyLimit;
    }

    function dailyLimit() public view returns (uint256) {
        return uintStorage[keccak256(abi.encodePacked("dailyLimit"))];
    }

    function setExecutionDailyLimit(uint256 _dailyLimit) external onlyOwner {
        require(_dailyLimit > executionMaxPerTx() || _dailyLimit == 0);
        emit ExecutionDailyLimitChanged(executionDailyLimit(), _dailyLimit);
        uintStorage[keccak256(abi.encodePacked("executionDailyLimit"))] = _dailyLimit;
    }

    function executionDailyLimit() public view returns (uint256) {
        return uintStorage[keccak256(abi.encodePacked("executionDailyLimit"))];
    }

    function setExecutionMaxPerTx(uint256 _maxPerTx) external onlyOwner {
        require(_maxPerTx < executionDailyLimit());
        uintStorage[keccak256(abi.encodePacked("executionMaxPerTx"))] = _maxPerTx;
    }

    function setMaxPerTx(uint256 _maxPerTx) external onlyOwner {
        require(_maxPerTx < dailyLimit());
        uintStorage[keccak256(abi.encodePacked("maxPerTx"))] = _maxPerTx;
    }

    function setMinPerTx(uint256 _minPerTx) external onlyOwner {
        require(_minPerTx < dailyLimit() && _minPerTx < maxPerTx());
        uintStorage[keccak256(abi.encodePacked("minPerTx"))] = _minPerTx;
    }

    function withinLimit(uint256 _amount) public view returns (bool) {
        uint256 nextLimit = totalSpentPerDay(getCurrentDay()).add(_amount);
        return dailyLimit() >= nextLimit && _amount <= maxPerTx() && _amount >= minPerTx();
    }

    function withinExecutionLimit(uint256 _amount) public view returns (bool) {
        uint256 nextLimit = totalExecutedPerDay(getCurrentDay()).add(_amount);
        return executionDailyLimit() >= nextLimit && _amount <= executionMaxPerTx();
    }

    function claimTokens(address _token, address _to) public onlyIfUpgradeabilityOwner validAddress(_to) {
        claimValues(_token, _to);
    }
}
