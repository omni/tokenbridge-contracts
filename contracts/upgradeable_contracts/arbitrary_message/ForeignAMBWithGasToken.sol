pragma solidity 0.4.24;

import "./ForeignAMB.sol";
import "../GasTokenConnector.sol";

contract ForeignAMBWithGasToken is ForeignAMB, GasTokenConnector {
    function executeSignatures(bytes _data, bytes _signatures) public {
        super.executeSignatures(_data, _signatures);
        _collectGasTokens();
    }
}
