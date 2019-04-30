pragma solidity 0.4.24;


import "./ERC677Bridge.sol";
import "../IBurnableMintableERC677Token.sol";


contract ERC677BridgeForBurnableMintableToken is ERC677Bridge {
    function bridgeSpecificActionsOnTokenTransfer(IBurnableMintableERC677Token _token, address _from, uint256 _value) internal {
        _token.burn(_value);
        fireEventOnTokenTransfer(_from, _value);
    }
}
