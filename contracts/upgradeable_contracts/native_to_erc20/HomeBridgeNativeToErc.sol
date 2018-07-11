pragma solidity 0.4.24;
import "../../libraries/SafeMath.sol";
import "../../libraries/Message.sol";
import "../BasicBridge.sol";
import "../../upgradeability/EternalStorage.sol";
import "../BasicHomeBridge.sol";

contract Sacrifice {
    constructor(address _recipient) public payable {
        selfdestruct(_recipient);
    }
}

contract HomeBridgeNativeToErc is EternalStorage, BasicBridge, BasicHomeBridge {

    function initialize (
        address _validatorContract,
        uint256 _dailyLimit,
        uint256 _maxPerTx,
        uint256 _minPerTx,
        uint256 _homeGasPrice,
        uint256 _requiredBlockConfirmations
    ) public
      returns(bool)
    {
        require(!isInitialized());
        require(_validatorContract != address(0));
        require(_homeGasPrice > 0);
        require(_requiredBlockConfirmations > 0);
        require(_minPerTx > 0 && _maxPerTx > _minPerTx && _dailyLimit > _maxPerTx);
        addressStorage[keccak256(abi.encodePacked("validatorContract"))] = _validatorContract;
        uintStorage[keccak256(abi.encodePacked("deployedAtBlock"))] = block.number;
        uintStorage[keccak256(abi.encodePacked("dailyLimit"))] = _dailyLimit;
        uintStorage[keccak256(abi.encodePacked("maxPerTx"))] = _maxPerTx;
        uintStorage[keccak256(abi.encodePacked("minPerTx"))] = _minPerTx;
        uintStorage[keccak256(abi.encodePacked("gasPrice"))] = _homeGasPrice;
        uintStorage[keccak256(abi.encodePacked("requiredBlockConfirmations"))] = _requiredBlockConfirmations;
        setInitialize(true);
        return isInitialized();
    }

    function () public payable {
        require(msg.value > 0);
        require(msg.data.length == 0);
        require(withinLimit(msg.value));
        setTotalSpentPerDay(getCurrentDay(), totalSpentPerDay(getCurrentDay()).add(msg.value));
        incrementNonce(msg.sender);
        uint256 nonce = getNonce(msg.sender);
        bytes32 status = keccak256(abi.encodePacked(msg.sender, msg.value, nonce));
        setTxStatus(status, uint256(TxStatus.Received));

        emit UserRequestForSignature(msg.sender, msg.value);
    }

    function onExecuteAffirmation(address _recipient, uint256 _value) internal returns(bool) {
        if (!_recipient.send(_value)) {
            (new Sacrifice).value(_value)(_recipient);
        }
        return true;
    }

    function onMitmPrevention(bytes message) internal returns(bool) {
        address recipient;
        uint256 amount;
        bytes32 txHash;
        (recipient, amount, txHash) = Message.parseMessage(message);
        bytes32 currentTx = keccak256(abi.encodePacked(recipient, amount, getNonce(recipient)));
        return getTxStatus(currentTx) == uint256(TxStatus.Received);
    }
}
