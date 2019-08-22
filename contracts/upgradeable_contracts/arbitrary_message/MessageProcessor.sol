pragma solidity 0.4.24;

import "./BalanceHandler.sol";

contract MessageProcessor is BalanceHandler {
    uint256 internal constant PASS_MESSAGE_GAS = 100000;
    bytes32 internal constant MESSAGE_SENDER = keccak256(abi.encodePacked("messageSender"));
    bytes32 internal constant TRANSACTION_HASH = keccak256(abi.encodePacked("transactionHash"));

    function messageSender() external view returns (address) {
        return addressStorage[MESSAGE_SENDER];
    }

    function setMessageSender(address _sender) internal {
        addressStorage[MESSAGE_SENDER] = _sender;
    }

    function transactionHash() external view returns (bytes32) {
        return getTransactionHash(bytesStorage[TRANSACTION_HASH]);
    }

    function getTransactionHash(bytes _txHash) internal view returns (bytes32 result) {
        assembly {
            result := mload(add(_txHash, 32))
        }
    }

    function setTransactionHash(bytes32 _txHash) internal {
        bytesStorage[TRANSACTION_HASH] = abi.encodePacked(_txHash);
    }

    function processMessage(
        address sender,
        address executor,
        bytes32 txHash,
        uint256 gasLimit,
        bytes1 dataType,
        uint256 gasPrice,
        bytes memory data
    ) internal {
        bool status;

        if (dataType == 0x00) {
            require(isMessageProcessorSubsidizedMode());
            status = _passMessage(sender, executor, data, gasLimit, txHash);
        } else if (dataType == 0x01) {
            require(!isMessageProcessorSubsidizedMode());
            require(gasPrice == tx.gasprice);
            status = _defrayAndPassMessage(sender, executor, data, gasLimit, txHash);
        } else if (dataType == 0x02) {
            require(!isMessageProcessorSubsidizedMode());
            status = _defrayAndPassMessage(sender, executor, data, gasLimit, txHash);
        } else {
            status = false;
        }

        emitEventOnMessageProcessed(sender, executor, txHash, status);
    }

    function _defrayAndPassMessage(address _sender, address _contract, bytes _data, uint256 _gas, bytes32 _txHash)
        internal
        returns (bool)
    {
        uint256 fee = PASS_MESSAGE_GAS.add(_gas).mul(tx.gasprice);
        require(balanceOf(_sender) >= fee);
        require(address(this).balance >= fee);

        setBalanceOf(_sender, balanceOf(_sender).sub(fee));

        bool status = _passMessage(_sender, _contract, _data, _gas, _txHash);

        msg.sender.transfer(fee);

        return status;
    }

    function _passMessage(address _sender, address _contract, bytes _data, uint256 _gas, bytes32 _txHash)
        internal
        returns (bool)
    {
        if (_contract == address(this)) {
            //Special check to handle invocation of withdrawFromDeposit
            if (isWithdrawFromDepositSelector(_data)) {
                setAccountForAction(_sender);
            }
        }
        setMessageSender(_sender);
        setTransactionHash(_txHash);
        bool status = _contract.call.gas(_gas)(_data);
        setMessageSender(address(0));
        setTransactionHash(bytes32(0));
        return status;
    }

    function isMessageProcessorSubsidizedMode() internal returns (bool);

    function emitEventOnMessageProcessed(address sender, address executor, bytes32 txHash, bool status) internal;
}
