pragma solidity 0.4.24;

import "../../interfaces/IAMB.sol";
import "../Ownable.sol";
import "openzeppelin-solidity/contracts/AddressUtils.sol";
import "../Initializable.sol";
import "../BaseERC677Bridge.sol";
import "../BaseOverdrawManagement.sol";
import "../ReentrancyGuard.sol";
import "../Upgradeable.sol";
import "../Claimable.sol";
import "../VersionableBridge.sol";

contract BasicAMBErc677ToErc677 is
    Initializable,
    Ownable,
    ReentrancyGuard,
    Upgradeable,
    Claimable,
    VersionableBridge,
    BaseOverdrawManagement,
    BaseERC677Bridge
{
    bytes32 internal constant BRIDGE_CONTRACT = keccak256(abi.encodePacked("bridgeContract"));
    bytes32 internal constant MEDIATOR_CONTRACT = keccak256(abi.encodePacked("mediatorContract"));
    bytes32 internal constant REQUEST_GAS_LIMIT = keccak256(abi.encodePacked("requestGasLimit"));

    function initialize(
        address _bridgeContract,
        address _mediatorContract,
        address _erc677token,
        uint256 _dailyLimit,
        uint256 _maxPerTx,
        uint256 _minPerTx,
        uint256 _executionDailyLimit,
        uint256 _executionMaxPerTx,
        uint256 _requestGasLimit,
        uint256 _decimalShift,
        address _owner
    ) external returns (bool) {
        require(!isInitialized());
        require(_minPerTx > 0 && _maxPerTx > _minPerTx && _dailyLimit > _maxPerTx);
        require(_executionMaxPerTx < _executionDailyLimit);

        uintStorage[DEPLOYED_AT_BLOCK] = block.number;
        _setBridgeContract(_bridgeContract);
        _setMediatorContractOnOtherSide(_mediatorContract);
        setErc677token(_erc677token);
        uintStorage[DAILY_LIMIT] = _dailyLimit;
        uintStorage[MAX_PER_TX] = _maxPerTx;
        uintStorage[MIN_PER_TX] = _minPerTx;
        uintStorage[EXECUTION_DAILY_LIMIT] = _executionDailyLimit;
        uintStorage[EXECUTION_MAX_PER_TX] = _executionMaxPerTx;
        _setRequestGasLimit(_requestGasLimit);
        uintStorage[DECIMAL_SHIFT] = _decimalShift;
        setOwner(_owner);
        setInitialize();

        emit DailyLimitChanged(_dailyLimit);
        emit ExecutionDailyLimitChanged(_executionDailyLimit);

        return isInitialized();
    }

    function passMessage(address _from, uint256 _value) internal {
        bytes4 methodSelector = this.handleBridgedTokens.selector;
        bytes memory data = abi.encodeWithSelector(methodSelector, _from, _value);
        bridgeContract().requireToPassMessage(mediatorContractOnOtherSide(), data, requestGasLimit());
    }

    function relayTokens(uint256 _value) external {
        // This lock is to prevent calling passMessage twice if a ERC677 token is used.
        // When transferFrom is called, after the transfer, the ERC677 token will call onTokenTransfer from this contract
        // which will call passMessage.
        require(!lock());
        ERC677 token = erc677token();
        address from = msg.sender;
        address to = address(this);
        require(withinLimit(_value));
        setTotalSpentPerDay(getCurrentDay(), totalSpentPerDay(getCurrentDay()).add(_value));

        setLock(true);
        token.transferFrom(from, to, _value);
        setLock(false);
        bridgeSpecificActionsOnTokenTransfer(token, from, _value);
    }

    function getBridgeInterfacesVersion() external pure returns (uint64 major, uint64 minor, uint64 patch) {
        return (1, 0, 0);
    }

    function getBridgeMode() external pure returns (bytes4 _data) {
        return bytes4(keccak256(abi.encodePacked("erc-to-erc-amb")));
    }

    function setBridgeContract(address _bridgeContract) external onlyOwner {
        _setBridgeContract(_bridgeContract);
    }

    function _setBridgeContract(address _bridgeContract) internal {
        require(AddressUtils.isContract(_bridgeContract));
        addressStorage[BRIDGE_CONTRACT] = _bridgeContract;
    }

    function bridgeContract() public view returns (IAMB) {
        return IAMB(addressStorage[BRIDGE_CONTRACT]);
    }

    function setMediatorContractOnOtherSide(address _mediatorContract) external onlyOwner {
        _setMediatorContractOnOtherSide(_mediatorContract);
    }

    function _setMediatorContractOnOtherSide(address _mediatorContract) internal {
        addressStorage[MEDIATOR_CONTRACT] = _mediatorContract;
    }

    function mediatorContractOnOtherSide() public view returns (address) {
        return addressStorage[MEDIATOR_CONTRACT];
    }

    function setRequestGasLimit(uint256 _requestGasLimit) external onlyOwner {
        _setRequestGasLimit(_requestGasLimit);
    }

    function _setRequestGasLimit(uint256 _requestGasLimit) internal {
        require(_requestGasLimit <= maxGasPerTx());
        uintStorage[REQUEST_GAS_LIMIT] = _requestGasLimit;
    }

    function requestGasLimit() public view returns (uint256) {
        return uintStorage[REQUEST_GAS_LIMIT];
    }

    function messageSender() internal view returns (address) {
        return bridgeContract().messageSender();
    }

    function transactionHash() internal view returns (bytes32) {
        return bridgeContract().transactionHash();
    }

    function maxGasPerTx() internal view returns (uint256) {
        return bridgeContract().maxGasPerTx();
    }

    function handleBridgedTokens(address _recipient, uint256 _value) external {
        require(msg.sender == address(bridgeContract()));
        require(messageSender() == mediatorContractOnOtherSide());
        if (withinExecutionLimit(_value)) {
            setTotalExecutedPerDay(getCurrentDay(), totalExecutedPerDay(getCurrentDay()).add(_value));
            executeActionOnBridgedTokens(_recipient, _value);
        } else {
            bytes32 txHash = transactionHash();
            address recipient;
            uint256 value;
            (recipient, value) = txAboveLimits(txHash);
            require(recipient == address(0) && value == 0);
            setOutOfLimitAmount(outOfLimitAmount().add(_value));
            setTxAboveLimits(_recipient, _value, txHash);
            emit AmountLimitExceeded(_recipient, _value, txHash);
        }
    }

    /* solcov ignore next */
    function executeActionOnBridgedTokens(address _recipient, uint256 _value) internal;

    function fixAssetsAboveLimits(bytes32 txHash, bool unlockOnForeign, uint256 valueToUnlock)
        external
        onlyIfUpgradeabilityOwner
    {
        require(!fixedAssets(txHash));
        require(valueToUnlock <= maxPerTx());
        address recipient;
        uint256 value;
        (recipient, value) = txAboveLimits(txHash);
        require(recipient != address(0) && value > 0 && value >= valueToUnlock);
        setOutOfLimitAmount(outOfLimitAmount().sub(valueToUnlock));
        uint256 pendingValue = value.sub(valueToUnlock);
        setTxAboveLimitsValue(pendingValue, txHash);
        emit AssetAboveLimitsFixed(txHash, valueToUnlock, pendingValue);
        if (pendingValue == 0) {
            setFixedAssets(txHash);
        }
        if (unlockOnForeign) {
            passMessage(recipient, valueToUnlock);
        }
    }

    function claimTokens(address _token, address _to) public onlyIfUpgradeabilityOwner validAddress(_to) {
        claimValues(_token, _to);
    }
}
