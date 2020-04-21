pragma solidity 0.4.24;

import "./BasicAMBErc677ToErc677.sol";
import "../../interfaces/IBurnableMintableERC677Token.sol";

contract HomeAMBErc677ToErc677 is BasicAMBErc677ToErc677 {
    function executeActionOnBridgedTokens(address _recipient, uint256 _value) internal {
        uint256 value = _value.mul(10**decimalShift());
        IBurnableMintableERC677Token(erc677token()).mint(_recipient, value);
    }

    /**
     * @dev Executes action on withdrawal of bridged tokens
     * @param _token address of token contract
     * @param _from address of tokens sender
     * @param _value requsted amount of bridged tokens
     * @param _data alternative receiver, if specified
     */
    function bridgeSpecificActionsOnTokenTransfer(ERC677 _token, address _from, uint256 _value, bytes _data) internal {
        if (!lock()) {
            IBurnableMintableERC677Token(_token).burn(_value);
            passMessage(_from, chooseReceiver(_from, _data), _value);
        }
    }

    function executeActionOnFixedTokens(address _recipient, uint256 _value) internal {
        IBurnableMintableERC677Token(erc677token()).mint(_recipient, _value);
    }
}
