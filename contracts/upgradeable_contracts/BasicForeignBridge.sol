pragma solidity 0.4.24;

import "../upgradeability/EternalStorage.sol";
import "../libraries/SafeMath.sol";
import "openzeppelin-solidity/contracts/token/ERC20/ERC20Basic.sol";
import "./Validatable.sol";
import "../libraries/Message.sol";

contract BasicForeignBridge is EternalStorage, Validatable {
    using SafeMath for uint256;
    /// triggered when relay of deposit from HomeBridge is complete

    event RelayedMessage(address recipient, uint value, bytes32 transactionHash);
    function executeSignatures(uint8[] vs, bytes32[] rs, bytes32[] ss, bytes message) external {
        Message.hasEnoughValidSignatures(message, vs, rs, ss, validatorContract());
        address recipient;
        uint256 amount;
        bytes32 txHash;
        (recipient, amount, txHash) = Message.parseMessage(message);
        require(!relayedMessages(txHash));
        setRelayedMessages(txHash, true);
        require(onExecuteMessage(recipient, amount));
        emit RelayedMessage(recipient, amount, txHash);
    }

    function onExecuteMessage(address _recipient, uint256 _amount) private returns(bool){
        // has to be defined
    }

    function setRelayedMessages(bytes32 _txHash, bool _status) private {
        boolStorage[keccak256(abi.encodePacked("relayedMessages", _txHash))] = _status;
    }

    function relayedMessages(bytes32 _txHash) public view returns(bool) {
        return boolStorage[keccak256(abi.encodePacked("relayedMessages", _txHash))];
    }
}
