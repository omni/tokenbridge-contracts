pragma solidity 0.4.24;

import "../../libraries/Message.sol";
import "./BasicAMB.sol";
import "./MessageDelivery.sol";
import "./MessageProcessor.sol";
import "../MessageRelay.sol";

contract BasicForeignAMB is BasicAMB, MessageRelay, MessageDelivery, MessageProcessor {
    function executeSignatures(bytes _data, uint8[] vs, bytes32[] rs, bytes32[] ss) external {
        Message.hasEnoughValidSignatures(_data, vs, rs, ss, validatorContract(), true);

        processMessage(_data, true);
    }
}
