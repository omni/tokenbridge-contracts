pragma solidity 0.4.24;

import "../upgradeability/EternalStorage.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "openzeppelin-solidity/contracts/token/ERC20/ERC20Basic.sol";
import "./Validatable.sol";
import "../libraries/Message.sol";
import "./BasicBridge.sol";

contract BasicForeignBridge is EternalStorage, Validatable, BasicBridge {
    using SafeMath for uint256;
    /// triggered when relay of deposit from HomeBridge is complete
    event RelayedMessage(address recipient, uint value, bytes32 transactionHash);
    function executeSignatures(uint8[] vs, bytes32[] rs, bytes32[] ss, bytes message) external {
        Message.hasEnoughValidSignatures(message, vs, rs, ss, validatorContract());
        address recipient;
        uint256 amount;
        bytes32 txHash;
        address contractAddress;
        (recipient, amount, txHash, contractAddress) = Message.parseMessage(message);
        if (withinExecutionLimit(amount)) {
            require(contractAddress == address(this));
            require(!relayedMessages(txHash));
            setRelayedMessages(txHash, true);
            require(onExecuteMessage(recipient, amount, txHash));
            emit RelayedMessage(recipient, amount, txHash);
        } else {
            onFailedMessage(recipient, amount, txHash);
        }
    }

    function onExecuteMessage(address, uint256, bytes32) internal returns(bool);

    function setRelayedMessages(bytes32 _txHash, bool _status) internal {
        boolStorage[keccak256(abi.encodePacked("relayedMessages", _txHash))] = _status;
    }

    function relayedMessages(bytes32 _txHash) public view returns(bool) {
        return boolStorage[keccak256(abi.encodePacked("relayedMessages", _txHash))];
    }

    function onFailedMessage(address, uint256, bytes32) internal;
}
