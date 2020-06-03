pragma solidity 0.4.24;

import "./ForeignAMB.sol";
import "../GasTokenConnector.sol";

contract ForeignAMBWithGasToken is ForeignAMB, GasTokenConnector {
    function requireToPassMessage(address _contract, bytes _data, uint256 _gas) public returns (bytes32 messageId) {
        messageId = super.requireToPassMessage(_contract, _data, _gas);
        _collectGasTokens();
    }
}
