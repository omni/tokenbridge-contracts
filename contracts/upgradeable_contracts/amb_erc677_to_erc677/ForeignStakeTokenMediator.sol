pragma solidity 0.4.24;

import "./BasicStakeTokenMediator.sol";
import "../../interfaces/IBurnableMintableERC677Token.sol";

contract ForeignStakeTokenMediator is BasicStakeTokenMediator {
    /**
     * @dev Executes action on the request to withdraw tokens relayed from the other network
     * @param _recipient address of tokens receiver
     * @param _value amount of bridged tokens
     */
    function executeActionOnBridgedTokens(address _recipient, uint256 _value) internal {
        uint256 value = _value.div(10**decimalShift());
        _transferWithOptionalMint(_recipient, value);
    }

    /**
     * @dev Executes action on deposit of bridged tokens
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
            passMessage(_from, chooseReceiver(_from, _data), _value);
        }
    }

    /**
     * @dev Executes action on relayed request to fix the failed transfer of tokens
     * @param _recipient address of tokens receiver
     * @param _value amount of fixed tokens
     */
    function executeActionOnFixedTokens(address _recipient, uint256 _value) internal {
        _transferWithOptionalMint(_recipient, _value);
    }

    /**
     * @dev Internal function for transfer of tokens, with optional minting if current balance is insufficient
     * @param _recipient address of tokens receiver
     * @param _value amount of fixed tokens
     */
    function _transferWithOptionalMint(address _recipient, uint256 _value) internal {
        IBurnableMintableERC677Token token = IBurnableMintableERC677Token(erc677token());
        uint256 balance = token.balanceOf(address(this));
        if (balance == 0) {
            token.mint(_recipient, _value);
        } else if (balance < _value) {
            token.mint(address(this), _value - balance);
            token.transfer(_recipient, _value);
        } else {
            token.transfer(_recipient, _value);
        }
    }
}
