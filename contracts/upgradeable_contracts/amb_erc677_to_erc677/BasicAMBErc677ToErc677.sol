pragma solidity 0.4.24;

import "../../interfaces/IAMB.sol";
import "../Ownable.sol";
import "openzeppelin-solidity/contracts/AddressUtils.sol";
import "../Initializable.sol";
import "../ERC677Bridge.sol";

contract BasicAMBErc677ToErc677 is Initializable, Ownable, ERC677Bridge {
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
        address _owner
    ) external returns (bool) {
        require(!isInitialized());
        require(AddressUtils.isContract(_bridgeContract));
        require(AddressUtils.isContract(_mediatorContract));
        require(_minPerTx > 0 && _maxPerTx > _minPerTx && _dailyLimit > _maxPerTx);
        require(_executionMaxPerTx < _executionDailyLimit);

        uintStorage[DEPLOYED_AT_BLOCK] = block.number;
        _setBridgeContract(_bridgeContract);
        _setMediatorContract(_mediatorContract);
        setErc677token(_erc677token);
        uintStorage[DAILY_LIMIT] = _dailyLimit;
        uintStorage[MAX_PER_TX] = _maxPerTx;
        uintStorage[MIN_PER_TX] = _minPerTx;
        uintStorage[EXECUTION_DAILY_LIMIT] = _executionDailyLimit;
        uintStorage[EXECUTION_MAX_PER_TX] = _executionMaxPerTx;
        _setRequestGasLimit(_requestGasLimit);
        setOwner(_owner);
        setInitialize();

        emit DailyLimitChanged(_dailyLimit);
        emit ExecutionDailyLimitChanged(_executionDailyLimit);

        return isInitialized();
    }

    function fireEventOnTokenTransfer(address _from, uint256 _value) internal {
        bytes4 methodSelector = this.handleBridgedTokens.selector;
        bytes memory data = abi.encodeWithSelector(methodSelector, _from, _value);
        bridgeContract().requireToPassMessage(mediatorContract(), data, requestGasLimit());
    }

    function validBridgedTokens(uint256 _value) internal {
        require(msg.sender == address(bridgeContract()));
        require(messageSender() == mediatorContract());
        require(withinExecutionLimit(_value));

        setTotalExecutedPerDay(getCurrentDay(), totalExecutedPerDay(getCurrentDay()).add(_value));
    }

    function relayTokens(uint256 _value) external {
        ERC677 token = erc677token();
        address from = msg.sender;
        address to = address(this);
        require(_value <= token.allowance(from, to));
        require(withinLimit(_value));
        setTotalSpentPerDay(getCurrentDay(), totalSpentPerDay(getCurrentDay()).add(_value));

        token.transferFrom(from, to, _value);
        bridgeSpecificActionsOnTokenTransfer(token, from, _value);
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

    function setMediatorContract(address _mediatorContract) external onlyOwner {
        _setMediatorContract(_mediatorContract);
    }

    function _setMediatorContract(address _mediatorContract) internal {
        require(AddressUtils.isContract(_mediatorContract));
        addressStorage[MEDIATOR_CONTRACT] = _mediatorContract;
    }

    function mediatorContract() public view returns (address) {
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

    function messageSender() public view returns (address) {
        return bridgeContract().messageSender();
    }

    function maxGasPerTx() public view returns (uint256) {
        return bridgeContract().maxGasPerTx();
    }

    function handleBridgedTokens(address _recipient, uint256 _value) external;
}
