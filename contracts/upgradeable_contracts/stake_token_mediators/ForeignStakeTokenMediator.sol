pragma solidity 0.4.24;

import "./BasicStakeTokenMediator.sol";
import "../../interfaces/IBurnableMintableERC677Token.sol";

contract ForeignStakeTokenMediator is BasicStakeTokenMediator {
    /**
     * @dev Executes action on incoming tokens from the other network
     * @param _recipient address of tokens receiver
     * @param _value amount of bridged tokens
     */
    function executeActionOnBridgedTokens(address _recipient, uint256 _value) internal {
        uint256 value = _value.div(10**decimalShift());
        executeActionOnFixedTokens(_recipient, value);
    }

    /**
     * @dev Executes action on incoming bridged tokens
     * @param _from address of tokens sender
     * @param _value requsted amount of bridged tokens
     * @param _data alternative receiver, if specified
     */
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

    /**
     * @dev Executes action on fixed tokens
     * @param _recipient address of tokens receiver
     * @param _value amount of fixed tokens
     */
    function executeActionOnFixedTokens(address _recipient, uint256 _value) internal {
        IBurnableMintableERC677Token token = IBurnableMintableERC677Token(erc677token());
        uint256 balance = token.balanceOf(address(this));
        if (_recipient != address(0) && balance == 0) {
            token.mint(_recipient, _value);
        } else if (balance < _value) {
            token.mint(address(this), _value - balance);
            token.transfer(_recipient, _value);
        } else {
            token.transfer(_recipient, _value);
        }
    }
}
