pragma solidity 0.4.24;

import "./BasicAMB.sol";
import "./MessageProcessor.sol";
import "../../libraries/ArbitraryMessage.sol";
import "./MessageDelivery.sol";


contract BasicForeignAMB is BasicAMB, MessageDelivery, MessageProcessor {

    function executeSignatures(uint8[] vs, bytes32[] rs, bytes32[] ss, bytes _data) external onlyValidator {
        ArbitraryMessage.hasEnoughValidSignatures(_data, vs, rs, ss, validatorContract());

        processMessage(_data);
    }

    function relayedMessages(bytes32 _txHash) public view returns(bool) {
        return boolStorage[keccak256(abi.encodePacked("relayedMessages", _txHash))];
    }

    function setRelayedMessages(bytes32 _txHash, bool _status) internal {
        boolStorage[keccak256(abi.encodePacked("relayedMessages", _txHash))] = _status;
    }

}
