pragma solidity 0.4.24;

import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "./BasicAMB.sol";

contract MessageDelivery is BasicAMB {
    using SafeMath for uint256;

    function requireToPassMessage(address _contract, bytes _data, uint256 _gas) public {
        require(isMessageDeliverySubsidizedMode());
        require(_gas >= getMinimumGasUsage(_data) && _gas <= maxGasPerTx());
        emitEventOnMessageRequest(abi.encodePacked(msg.sender, _contract, _gas, uint8(0x00), _data));
    }

    function requireToPassMessage(address _contract, bytes _data, uint256 _gas, uint256 _gasPrice) public {
        if (isMessageDeliverySubsidizedMode()) requireToPassMessage(_contract, _data, _gas);
        else {
            require(_gas >= getMinimumGasUsage(_data) && _gas <= maxGasPerTx());
            emitEventOnMessageRequest(abi.encodePacked(msg.sender, _contract, _gas, uint8(0x01), _gasPrice, _data));
        }
    }

    function requireToPassMessage(address _contract, bytes _data, uint256 _gas, bytes1 _oracleGasPriceSpeed) public {
        if (isMessageDeliverySubsidizedMode()) requireToPassMessage(_contract, _data, _gas);
        else {
            require(_gas >= getMinimumGasUsage(_data) && _gas <= maxGasPerTx());
            emitEventOnMessageRequest(
                abi.encodePacked(msg.sender, _contract, _gas, uint8(0x02), _oracleGasPriceSpeed, _data)
            );
        }
    }

    function getMinimumGasUsage(bytes _data) public pure returns (uint256 gas) {
        //From Ethereum Yellow Paper
        // 68 gas is paid for every non-zero byte of data or code for a transaction
        return _data.length.mul(68);
    }

    function isMessageDeliverySubsidizedMode() internal returns (bool);

    function emitEventOnMessageRequest(bytes encodedData) internal;
}
