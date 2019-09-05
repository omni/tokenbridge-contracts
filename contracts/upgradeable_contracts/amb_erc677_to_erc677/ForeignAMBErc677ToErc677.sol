pragma solidity 0.4.24;

import "./BasicAMBErc677ToErc677.sol";
import "../ERC677Bridge.sol";
import "openzeppelin-solidity/contracts/AddressUtils.sol";

contract ForeignAMBErc677ToErc677 is BasicAMBErc677ToErc677 {
    function executeActionOnBridgedTokens(address _recipient, uint256 _value) internal {
        erc677token().transfer(_recipient, _value);
    }

    function bridgeSpecificActionsOnTokenTransfer(
        ERC677, /* _token */
        address _from,
        uint256 _value
    ) internal {
        if (!lock()) {
            passMessage(_from, _value);
        }
    }
}
