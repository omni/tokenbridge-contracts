pragma solidity 0.4.24;

import "./BasicHomeAMB.sol";
import "./BasicForeignAMB.sol";


contract ForeignAMB is BasicForeignAMB {

    event UserRequestForAffirmation(bytes encodedData);

    function requireToPassMessage(address _contract, bytes _data, uint256 _gas) public {
        require(keccak256(foreignToHomeMode()) == keccak256(SUBSIDIZED_MODE));
        require(_gas >= getMinimumGasUsage(_data) && _gas <= maxPerTx());
        emit UserRequestForAffirmation(abi.encodePacked(msg.sender, _contract, _gas, uint8(0x00), _data));
    }

    function requireToPassMessage(address _contract, bytes _data, uint256 _gas, uint256 _gasPrice) public {
        if (keccak256(foreignToHomeMode()) == keccak256(SUBSIDIZED_MODE))
            requireToPassMessage(_contract, _data, _gas);
        else {
            require(_gas >= getMinimumGasUsage(_data) && _gas <= maxPerTx());
            emit UserRequestForAffirmation(
                abi.encodePacked(msg.sender, _contract, _gas, uint8(0x01), _gasPrice, _data)
            );
        }
    }

    function requireToPassMessage(address _contract, bytes _data, uint256 _gas, bytes1 _oracleGasPriceSpeed) public {
        if (keccak256(foreignToHomeMode()) == keccak256(SUBSIDIZED_MODE))
            requireToPassMessage(_contract, _data, _gas);
        else {
            require(_gas >= getMinimumGasUsage(_data) && _gas <= maxPerTx());
            emit UserRequestForAffirmation(
                abi.encodePacked(msg.sender, _contract, _gas, uint8(0x02), _oracleGasPriceSpeed, _data)
            );
        }
    }
}
