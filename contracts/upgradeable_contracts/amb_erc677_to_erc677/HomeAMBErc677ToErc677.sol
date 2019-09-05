pragma solidity 0.4.24;

import "./BasicAMBErc677ToErc677.sol";
import "../../interfaces/IBurnableMintableERC677Token.sol";
import "openzeppelin-solidity/contracts/AddressUtils.sol";

contract HomeAMBErc677ToErc677 is BasicAMBErc677ToErc677 {
    function executeActionOnBridgedTokens(address _recipient, uint256 _value) internal {
        IBurnableMintableERC677Token(erc677token()).mint(_recipient, _value);
    }

    function bridgeSpecificActionsOnTokenTransfer(ERC677 _token, address _from, uint256 _value) internal {
        IBurnableMintableERC677Token(_token).burn(_value);
        passMessage(_from, _value);
    }
}
