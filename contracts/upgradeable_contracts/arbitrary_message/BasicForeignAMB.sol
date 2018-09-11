pragma solidity 0.4.24;

import "./BasicAMB.sol";
import "../../libraries/ArbitraryMessage.sol";


contract BasicForeignAMB is BasicAMB {
    uint256 internal constant PASS_MESSAGE_GAS = 100000;
    address internal accountForAction = address(0);

    event RelayedMessage(address sender, address executor, bytes32 transactionHash);

    function executeSignatures(uint8[] vs, bytes32[] rs, bytes32[] ss, bytes _data) external onlyValidator {
        ArbitraryMessage.hasEnoughValidSignatures(_data, vs, rs, ss, validatorContract());

        processMessage(_data);
    }

    function withdrawFromDeposit(address _recipient) public {
        require(msg.sender == address(this));
        require(accountForAction != address(0));
        require(balanceOf(accountForAction) > 0);
        uint256 withdrawValue = balanceOf(accountForAction);
        setBalanceOf(accountForAction, 0);
        _recipient.transfer(withdrawValue);
        accountForAction = address(0);
    }

    function relayedMessages(bytes32 _txHash) public view returns(bool) {
        return boolStorage[keccak256(abi.encodePacked("relayedMessages", _txHash))];
    }

    function balanceOf(address _balanceHolder) public view returns(uint) {
        return uintStorage[keccak256(abi.encodePacked("balances", _balanceHolder))];
    }

    function isWithdrawFromDepositSelector(bytes _data) internal pure returns(bool _retval) {
        _retval = false;
        bytes4 withdrawFromDepositSelector = this.withdrawFromDeposit.selector;
        if ((_data[0] == withdrawFromDepositSelector[0]) &&
            (_data[1] == withdrawFromDepositSelector[1]) &&
            (_data[2] == withdrawFromDepositSelector[2]) &&
            (_data[3] == withdrawFromDepositSelector[3])) {
            _retval = true;
        }
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

    function _defrayAndPassMessage(address _sender, address _contract, bytes _data, uint256 _gas) internal {
        uint256 fee = PASS_MESSAGE_GAS.add(_gas).mul(tx.gasprice);
        require(balanceOf(_sender) >= fee);
        require(address(this).balance >= fee);

        setBalanceOf(_sender, balanceOf(_sender).sub(fee));

        _passMessage(_sender, _contract, _data, _gas);

        msg.sender.transfer(fee);
    }

    function processMessage(bytes _data) internal {
        address sender;
        address executor;
        uint256 gasLimit;
        bytes1 dataType;
        uint256 gasPrice;
        bytes32 txHash;
        bytes memory data;
        (sender, executor, txHash, gasLimit, dataType, gasPrice, data) = ArbitraryMessage.unpackData(_data);

        require(!relayedMessages(txHash));
        setRelayedMessages(txHash, true);

        bytes memory bridgeMode = homeToForeignMode();

        if (dataType == 0x00) {
            require(keccak256(bridgeMode) == keccak256(SUBSIDIZED_MODE));
            _passMessage(sender, executor, data, gasLimit);
        } else if (dataType == 0x01) {
            require(keccak256(bridgeMode) == keccak256(DEFRAYAL_MODE));
            require(gasPrice == tx.gasprice);
            _defrayAndPassMessage(sender, executor, data, gasLimit);
        } else if (dataType == 0x02) {
            require(keccak256(bridgeMode) == keccak256(DEFRAYAL_MODE));
            _defrayAndPassMessage(sender, executor, data, gasLimit);
        } else {
            revert();
        }

        emit RelayedMessage(sender, executor, txHash);
    }

    function setRelayedMessages(bytes32 _txHash, bool _status) internal {
        boolStorage[keccak256(abi.encodePacked("relayedMessages", _txHash))] = _status;
    }

    function setBalanceOf(address _balanceHolder, uint _amount) internal {
        uintStorage[keccak256(abi.encodePacked("balances", _balanceHolder))] = _amount;
    }
}
