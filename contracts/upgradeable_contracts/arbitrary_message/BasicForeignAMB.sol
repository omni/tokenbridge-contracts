pragma solidity 0.4.24;

import "../../libraries/ArbitraryMessage.sol";
import "./BasicAMB.sol";
import "./MessageDelivery.sol";
import "./MessageProcessor.sol";


contract BasicForeignAMB is BasicAMB, MessageDelivery, MessageProcessor {

    function executeSignatures(bytes _data, uint8[] vs, bytes32[] rs, bytes32[] ss) external onlyValidator {
        ArbitraryMessage.hasEnoughValidSignatures(_data, vs, rs, ss, validatorContract());

        processMessage(_data, true);
    }

    function relayedMessages(bytes32 _txHash) public view returns(bool) {
        return boolStorage[keccak256(abi.encodePacked("relayedMessages", _txHash))];
    }

    function setRelayedMessages(bytes32 _txHash, bool _status) internal {
        boolStorage[keccak256(abi.encodePacked("relayedMessages", _txHash))] = _status;
    }

}
