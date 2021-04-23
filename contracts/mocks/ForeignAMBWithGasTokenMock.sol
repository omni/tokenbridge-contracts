pragma solidity 0.4.24;

import "../upgradeable_contracts/arbitrary_message/ForeignAMBWithGasToken.sol";

/**
* @title ForeignAMBWithGasTokenMock
* @dev Wrapper on ForeignAMB contract, which supports minting gas tokens while passing messages
*/
contract ForeignAMBWithGasTokenMock is ForeignAMBWithGasToken {
    function gasToken() public pure returns (IGasToken) {
        // Address generated in unit test, also hardcoded in GasTokenMock
        return IGasToken(0x5b1869D9A4C187F2EAa108f3062412ecf0526b24);
    }

    function collectGasTokens() external {
        _collectGasTokens();
    }
}
