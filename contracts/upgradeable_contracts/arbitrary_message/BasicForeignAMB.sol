pragma solidity 0.4.24;

import "../../libraries/Message.sol";
import "../../libraries/ArbitraryMessage.sol";
import "./BasicAMB.sol";
import "./MessageDelivery.sol";
import "./MessageProcessor.sol";
import "../MessageRelay.sol";

contract BasicForeignAMB is BasicAMB, MessageRelay, MessageDelivery, MessageProcessor {
    function executeSignatures(bytes _data, uint8[] vs, bytes32[] rs, bytes32[] ss) external {
        Message.hasEnoughValidSignatures(_data, vs, rs, ss, validatorContract(), true);

        address sender;
        address executor;
        bytes32 txHash;
        uint256 gasLimit;
        bytes1 dataType;
        uint256 gasPrice;
        bytes memory data;

        (sender, executor, txHash, gasLimit, dataType, gasPrice, data) = ArbitraryMessage.unpackData(_data, true);
        require(!relayedMessages(txHash));
        setRelayedMessages(txHash, true);
        processMessage(sender, executor, txHash, gasLimit, dataType, gasPrice, data);
    }
}
