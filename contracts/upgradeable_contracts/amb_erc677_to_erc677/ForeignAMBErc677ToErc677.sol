pragma solidity 0.4.24;

import "./BasicAMBErc677ToErc677.sol";

contract ForeignAMBErc677ToErc677 is BasicAMBErc677ToErc677 {
    function executeActionOnBridgedTokens(address _recipient, uint256 _value) internal {
        uint256 value = _value.div(10**decimalShift());
        erc677token().transfer(_recipient, value);
    }

    function bridgeSpecificActionsOnTokenTransfer(
        ERC677, /* _token */
        address _from,
        uint256 _value,
        bytes _data
    ) internal {
        if (!lock()) {
            passMessage(chooseReceiver(_from, _data), _value);
        }
    }

    function executeActionOnFixedTokens(address _recipient, uint256 _value) internal {
        erc677token().transfer(_recipient, _value);
    }

    function _getTokenBalance() internal view returns (uint256) {
        return erc677token().balanceOf(address(this));
    }
}
