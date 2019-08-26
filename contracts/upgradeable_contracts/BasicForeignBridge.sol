pragma solidity 0.4.24;

import "../upgradeability/EternalStorage.sol";
import "openzeppelin-solidity/contracts/token/ERC20/ERC20Basic.sol";
import "./Validatable.sol";
import "../libraries/Message.sol";
import "./BasicBridge.sol";
import "./BasicTokenBridge.sol";
import "./MessageRelay.sol";

contract BasicForeignBridge is EternalStorage, Validatable, BasicBridge, BasicTokenBridge, MessageRelay {
    /// triggered when relay of deposit from HomeBridge is complete
    event RelayedMessage(address recipient, uint256 value, bytes32 transactionHash);
    function executeSignatures(uint8[] vs, bytes32[] rs, bytes32[] ss, bytes message) external {
        Message.hasEnoughValidSignatures(message, vs, rs, ss, validatorContract(), false);
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

    /* solcov ignore next */
    function onExecuteMessage(address, uint256, bytes32) internal returns (bool);

    /* solcov ignore next */
    function onFailedMessage(address, uint256, bytes32) internal;
}
