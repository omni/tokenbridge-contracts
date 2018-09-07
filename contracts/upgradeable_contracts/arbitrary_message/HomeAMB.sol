pragma solidity 0.4.24;

import "./BasicHomeAMB.sol";
import "./BasicForeignAMB.sol";


contract HomeAMB is BasicHomeAMB {
    event RequestForSignature(bytes encodedData);

    function requireToPassMessage(address _contract, bytes _data, uint256 _gas) public {
        require(keccak256(homeToForeignMode()) == keccak256(SUBSIDIZED_MODE));
        checkAndUpdateGasLimits(_gas);
        emit RequestForSignature(abi.encodePacked(msg.sender, _contract, _gas, uint8(0x00), _data));
    }

    function requireToPassMessage(address _contract, bytes _data, uint256 _gas, uint256 _gasPrice) public {
        if (keccak256(homeToForeignMode()) == keccak256(SUBSIDIZED_MODE))
            requireToPassMessage(_contract, _data, _gas);
        else {
            checkAndUpdateGasLimits(_gas);
            emit RequestForSignature(abi.encodePacked(msg.sender, _contract, _gas, uint8(0x01), _gasPrice, _data));
        }
    }

    function requireToPassMessage(address _contract, bytes _data, uint256 _gas, bytes1 _oracleGasPriceSpeed) public {
        if (keccak256(homeToForeignMode()) == keccak256(SUBSIDIZED_MODE))
            requireToPassMessage(_contract, _data, _gas);
        else {
            checkAndUpdateGasLimits(_gas);
            emit RequestForSignature(
                abi.encodePacked(msg.sender, _contract, _gas, uint8(0x02), _oracleGasPriceSpeed, _data)
            );
        }
    }
}
