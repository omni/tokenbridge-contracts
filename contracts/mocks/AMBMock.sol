pragma solidity 0.4.24;

contract AMBMock {
    event MockedEvent(bytes encodedData);

    address public messageSender;
    uint256 public maxGasPerTx;
    bytes32 public transactionHash;

    function setMaxGasPerTx(uint256 _value) public {
        maxGasPerTx = _value;
    }

    function executeMessageCall(address _contract, address _sender, bytes _data, bytes32 _txHash) public {
        messageSender = _sender;
        transactionHash = _txHash;
        require(_contract.call(_data));
        messageSender = address(0);
        transactionHash = bytes32(0);
    }

    function requireToPassMessage(address _contract, bytes _data, uint256 _gas) public {
        emit MockedEvent(abi.encodePacked(msg.sender, _contract, _gas, uint8(0x00), _data));
    }
}
