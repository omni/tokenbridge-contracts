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
import "../../libraries/Bytes.sol";

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
    event FailedMessageFixed(bytes32 indexed messageId, address recipient, uint256 value);

    bytes32 internal constant BRIDGE_CONTRACT = 0x811bbb11e8899da471f0e69a3ed55090fc90215227fc5fb1cb0d6e962ea7b74f; // keccak256(abi.encodePacked("bridgeContract"))
    bytes32 internal constant MEDIATOR_CONTRACT = 0x98aa806e31e94a687a31c65769cb99670064dd7f5a87526da075c5fb4eab9880; // keccak256(abi.encodePacked("mediatorContract"))
    bytes32 internal constant REQUEST_GAS_LIMIT = 0x2dfd6c9f781bb6bbb5369c114e949b69ebb440ef3d4dd6b2836225eb1dc3a2be; // keccak256(abi.encodePacked("requestGasLimit"))

    function initialize(
        address _bridgeContract,
        address _mediatorContract,
        address _erc677token,
        uint256[] _dailyLimitMaxPerTxMinPerTxArray, // [ 0 = _dailyLimit, 1 = _maxPerTx, 2 = _minPerTx ]
        uint256[] _executionDailyLimitExecutionMaxPerTxArray, // [ 0 = _executionDailyLimit, 1 = _executionMaxPerTx ]
        uint256 _requestGasLimit,
        uint256 _decimalShift,
        address _owner
    ) public onlyRelevantSender returns (bool) {
        require(!isInitialized());
        require(
            _dailyLimitMaxPerTxMinPerTxArray[2] > 0 && // _minPerTx > 0
                _dailyLimitMaxPerTxMinPerTxArray[1] > _dailyLimitMaxPerTxMinPerTxArray[2] && // _maxPerTx > _minPerTx
                _dailyLimitMaxPerTxMinPerTxArray[0] > _dailyLimitMaxPerTxMinPerTxArray[1] // _dailyLimit > _maxPerTx
        );
        require(_executionDailyLimitExecutionMaxPerTxArray[1] < _executionDailyLimitExecutionMaxPerTxArray[0]); // _executionMaxPerTx < _executionDailyLimit

        _setBridgeContract(_bridgeContract);
        _setMediatorContractOnOtherSide(_mediatorContract);
        setErc677token(_erc677token);
        uintStorage[DAILY_LIMIT] = _dailyLimitMaxPerTxMinPerTxArray[0];
        uintStorage[MAX_PER_TX] = _dailyLimitMaxPerTxMinPerTxArray[1];
        uintStorage[MIN_PER_TX] = _dailyLimitMaxPerTxMinPerTxArray[2];
        uintStorage[EXECUTION_DAILY_LIMIT] = _executionDailyLimitExecutionMaxPerTxArray[0];
        uintStorage[EXECUTION_MAX_PER_TX] = _executionDailyLimitExecutionMaxPerTxArray[1];
        _setRequestGasLimit(_requestGasLimit);
        uintStorage[DECIMAL_SHIFT] = _decimalShift;
        setOwner(_owner);
        setInitialize();

        emit DailyLimitChanged(_dailyLimitMaxPerTxMinPerTxArray[0]);
        emit ExecutionDailyLimitChanged(_executionDailyLimitExecutionMaxPerTxArray[0]);

        return isInitialized();
    }

    function bridgeContractOnOtherSide() internal view returns (address) {
        return mediatorContractOnOtherSide();
    }

    function passMessage(address _from, uint256 _value) internal {
        bytes4 methodSelector = this.handleBridgedTokens.selector;
        bytes memory data = abi.encodeWithSelector(methodSelector, _from, _value);

        bytes32 messageId = bridgeContract().requireToPassMessage(
            mediatorContractOnOtherSide(),
            data,
            requestGasLimit()
        );

        setMessageValue(messageId, _value);
        setMessageRecipient(messageId, _from);
    }

    function relayTokens(address _from, address _receiver, uint256 _value) external {
        require(_from == msg.sender || _from == _receiver);
        _relayTokens(_from, _receiver, _value);
    }

    function _relayTokens(address _from, address _receiver, uint256 _value) internal {
        // This lock is to prevent calling passMessage twice if a ERC677 token is used.
        // When transferFrom is called, after the transfer, the ERC677 token will call onTokenTransfer from this contract
        // which will call passMessage.
        require(!lock());
        ERC677 token = erc677token();
        address to = address(this);
        require(withinLimit(_value));
        setTotalSpentPerDay(getCurrentDay(), totalSpentPerDay(getCurrentDay()).add(_value));

        setLock(true);
        token.transferFrom(_from, to, _value);
        setLock(false);
        bridgeSpecificActionsOnTokenTransfer(token, _from, _value, abi.encodePacked(_receiver));
    }

    function relayTokens(address _receiver, uint256 _value) external {
        _relayTokens(msg.sender, _receiver, _value);
    }

    function onTokenTransfer(address _from, uint256 _value, bytes _data) external returns (bool) {
        ERC677 token = erc677token();
        require(msg.sender == address(token));
        if (!lock()) {
            require(withinLimit(_value));
            setTotalSpentPerDay(getCurrentDay(), totalSpentPerDay(getCurrentDay()).add(_value));
        }
        bridgeSpecificActionsOnTokenTransfer(token, _from, _value, _data);
        return true;
    }

    function getBridgeInterfacesVersion() external pure returns (uint64 major, uint64 minor, uint64 patch) {
        return (1, 1, 0);
    }

    function getBridgeMode() external pure returns (bytes4 _data) {
        return 0x76595b56; // bytes4(keccak256(abi.encodePacked("erc-to-erc-amb")))
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

    function _messageId() internal view returns (bytes32) {
        return bridgeContract().messageId();
    }

    function maxGasPerTx() internal view returns (uint256) {
        return bridgeContract().maxGasPerTx();
    }

    function setMessageValue(bytes32 _hash, uint256 _value) internal {
        uintStorage[keccak256(abi.encodePacked("messageHashValue", _hash))] = _value;
    }

    function messageValue(bytes32 _hash) internal view returns (uint256) {
        return uintStorage[keccak256(abi.encodePacked("messageHashValue", _hash))];
    }

    function setMessageRecipient(bytes32 _hash, address _recipient) internal {
        addressStorage[keccak256(abi.encodePacked("messageHashRecipient", _hash))] = _recipient;
    }

    function messageRecipient(bytes32 _hash) internal view returns (address) {
        return addressStorage[keccak256(abi.encodePacked("messageHashRecipient", _hash))];
    }

    function setMessageFixed(bytes32 _hash) internal {
        boolStorage[keccak256(abi.encodePacked("messageHashFixed", _hash))] = true;
    }

    function messageFixed(bytes32 _hash) public view returns (bool) {
        return boolStorage[keccak256(abi.encodePacked("messageHashFixed", _hash))];
    }

    function handleBridgedTokens(address _recipient, uint256 _value) external {
        require(msg.sender == address(bridgeContract()));
        require(messageSender() == mediatorContractOnOtherSide());
        if (withinExecutionLimit(_value)) {
            setTotalExecutedPerDay(getCurrentDay(), totalExecutedPerDay(getCurrentDay()).add(_value));
            executeActionOnBridgedTokens(_recipient, _value);
        } else {
            bytes32 messageId = _messageId();
            address recipient;
            uint256 value;
            (recipient, value) = txAboveLimits(messageId);
            require(recipient == address(0) && value == 0);
            setOutOfLimitAmount(outOfLimitAmount().add(_value));
            setTxAboveLimits(_recipient, _value, messageId);
            emit AmountLimitExceeded(_recipient, _value, messageId);
        }
    }

    function fixAssetsAboveLimits(bytes32 messageId, bool unlockOnForeign, uint256 valueToUnlock)
        external
        onlyIfUpgradeabilityOwner
    {
        require(!fixedAssets(messageId));
        require(valueToUnlock <= maxPerTx());
        address recipient;
        uint256 value;
        (recipient, value) = txAboveLimits(messageId);
        require(recipient != address(0) && value > 0 && value >= valueToUnlock);
        setOutOfLimitAmount(outOfLimitAmount().sub(valueToUnlock));
        uint256 pendingValue = value.sub(valueToUnlock);
        setTxAboveLimitsValue(pendingValue, messageId);
        emit AssetAboveLimitsFixed(messageId, valueToUnlock, pendingValue);
        if (pendingValue == 0) {
            setFixedAssets(messageId);
        }
        if (unlockOnForeign) {
            passMessage(recipient, valueToUnlock);
        }
    }

    function requestFailedMessageFix(bytes32 messageId) external {
        require(!bridgeContract().messageCallStatus(messageId));
        require(bridgeContract().failedMessageReceiver(messageId) == address(this));
        require(bridgeContract().failedMessageSender(messageId) == mediatorContractOnOtherSide());

        bytes4 methodSelector = this.fixFailedMessage.selector;
        bytes memory data = abi.encodeWithSelector(methodSelector, messageId);
        bridgeContract().requireToPassMessage(mediatorContractOnOtherSide(), data, requestGasLimit());
    }

    function fixFailedMessage(bytes32 messageId) external {
        require(msg.sender == address(bridgeContract()));
        require(messageSender() == mediatorContractOnOtherSide());
        require(!messageFixed(messageId));

        address recipient = messageRecipient(messageId);
        uint256 value = messageValue(messageId);
        setMessageFixed(messageId);
        executeActionOnFixedTokens(recipient, value);
        emit FailedMessageFixed(messageId, recipient, value);
    }

    function claimTokens(address _token, address _to) public onlyIfUpgradeabilityOwner validAddress(_to) {
        claimValues(_token, _to);
    }

    /* solcov ignore next */
    function executeActionOnBridgedTokens(address _recipient, uint256 _value) internal;

    /* solcov ignore next */
    function executeActionOnFixedTokens(address, uint256) internal;
}
