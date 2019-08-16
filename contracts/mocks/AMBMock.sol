pragma solidity 0.4.24;

contract AMBMock {
    address public messageSender;
    uint256 public maxGasPerTx;

    function setMessageSender(address _sender) public {
        messageSender = _sender;
    }

    function setMaxGasPerTx(uint256 _value) public {
        maxGasPerTx = _value;
    }

    function executeMessageCall(address _contract, address _sender, bytes _data) public {
        setMessageSender(_sender);
        require(_contract.call(_data));
        setMessageSender(address(0));
    }
}
