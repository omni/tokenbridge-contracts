pragma solidity 0.4.24;

import "./BalanceHandler.sol";
import "../../libraries/ArbitraryMessage.sol";


contract MessageProcessor is BalanceHandler {

    uint256 internal constant PASS_MESSAGE_GAS = 100000;

    function processMessage(bytes _data) internal {
        address sender;
        address executor;
        uint256 gasLimit;
        bytes1 dataType;
        uint256 gasPrice;
        bytes32 txHash;
        bytes memory data;
        (sender, executor, txHash, gasLimit, dataType, gasPrice, data) = ArbitraryMessage.unpackData(_data);

        require(!messageProcessed(txHash));
        setMessageProcessed(txHash, true);

        if (dataType == 0x00) {
            require(isMessageProcessorSubsidizedMode());
            _passMessage(sender, executor, data, gasLimit);
        } else if (dataType == 0x01) {
            require(!isMessageProcessorSubsidizedMode());
            require(gasPrice == tx.gasprice);
            _defrayAndPassMessage(sender, executor, data, gasLimit);
        } else if (dataType == 0x02) {
            require(!isMessageProcessorSubsidizedMode());
            _defrayAndPassMessage(sender, executor, data, gasLimit);
        } else {
            revert();
        }

        emitEventOnMessageProcessed(sender, executor, txHash);
    }

    function _defrayAndPassMessage(address _sender, address _contract, bytes _data, uint256 _gas) internal {
        uint256 fee = PASS_MESSAGE_GAS.add(_gas).mul(tx.gasprice);
        require(balanceOf(_sender) >= fee);
        require(address(this).balance >= fee);

        setBalanceOf(_sender, balanceOf(_sender).sub(fee));

        _passMessage(_sender, _contract, _data, _gas);

        msg.sender.transfer(fee);
    }

    function _passMessage(address _sender, address _contract, bytes _data, uint256 _gas) internal {
        if (_contract == address(this)) {
            //Special check to handle invocation of withdrawFromDeposit
            if (isWithdrawFromDepositSelector(_data)) {
                accountForAction = _sender;
            }
        }

        require(_contract.call.gas(_gas)(_data));
    }

    function isMessageProcessorSubsidizedMode() internal returns(bool) {
        // should be overridden
    }

    function emitEventOnMessageProcessed(address sender, address executor, bytes32 txHash) internal {
        // should be overridden
    }

    function messageProcessed(bytes32 _txHash) public view returns(bool) {
        // should be overridden
    }

    function setMessageProcessed(bytes32 _txHash, bool _status) internal {
        // should be overridden
    }
}
