pragma solidity 0.4.24;

import "../upgradeable_contracts/arbitrary_message/ForeignAMBWithGasToken.sol";

/**
* @title ForeignAMBWithGasTokenMock
* @dev Wrapper on ForeignAMB contract, which supports minting gas tokens while passing messages
*/
contract ForeignAMBWithGasTokenMock is ForeignAMBWithGasToken {
    function gasToken() public pure returns (IGasToken) {
        // Address generated in unit test, also hardcoded in GasTokenMock
        return IGasToken(0xEC8bE1A5630364292E56D01129E8ee8A9578d7D8);
    }

    function collectGasTokens() external {
        _collectGasTokens();
    }
}
