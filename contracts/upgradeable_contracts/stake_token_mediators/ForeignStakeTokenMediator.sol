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
        _mintLackingTokens(value);
        erc677token().transfer(_recipient, value);
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
        _mintLackingTokens(_value);
        erc677token().transfer(_recipient, _value);
    }

    /**
     * @dev Mints tokens if the bridge balance is insufficient.
     * This can happen after STAKE tokens emission in the xDai chain
     * @param _value amount of tokens, which are requested to be withdrawn
     */
    function _mintLackingTokens(uint256 _value) internal {
        IBurnableMintableERC677Token token = IBurnableMintableERC677Token(erc677token());
        uint256 balance = token.balanceOf(address(this));
        if (balance < _value) {
            // if bridge balance is less than requested value, the lacking part of tokens will be minted
            token.mint(address(this), _value - balance);
        }
    }
}
