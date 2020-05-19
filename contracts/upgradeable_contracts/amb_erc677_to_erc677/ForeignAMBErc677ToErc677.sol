pragma solidity 0.4.24;

import "./BasicAMBErc677ToErc677.sol";

/**
* @title ForeignAMBErc677ToErc677
* @dev Foreign side implementation for erc677-to-erc677 mediator intended to work on top of AMB bridge.
* It is designed to be used as an implementation contract of EternalStorageProxy contract.
*/
contract ForeignAMBErc677ToErc677 is BasicAMBErc677ToErc677 {
    /**
     * @dev Executes action on the request to withdraw tokens relayed from the other network
     * @param _recipient address of tokens receiver
     * @param _value amount of bridged tokens
     */
    function executeActionOnBridgedTokens(address _recipient, uint256 _value) internal {
        uint256 value = _value.div(10**decimalShift());
        bytes32 _messageId = messageId();
        erc677token().transfer(_recipient, value);
        emit TokensBridged(_recipient, value, _messageId);
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

    function executeActionOnFixedTokens(address _recipient, uint256 _value) internal {
        erc677token().transfer(_recipient, _value);
    }
}
