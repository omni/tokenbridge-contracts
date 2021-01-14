pragma solidity 0.4.24;

import "./BasicAMBErc677ToErc677.sol";
import "../../libraries/SafeERC20.sol";
import "../MediatorBalanceStorage.sol";

/**
* @title ForeignAMBErc677ToErc677
* @dev Foreign side implementation for erc677-to-erc677 mediator intended to work on top of AMB bridge.
* It is designed to be used as an implementation contract of EternalStorageProxy contract.
*/
contract ForeignAMBErc677ToErc677 is BasicAMBErc677ToErc677, MediatorBalanceStorage {
    using SafeERC20 for ERC677;

    /**
     * @dev Executes action on the request to withdraw tokens relayed from the other network
     * @param _recipient address of tokens receiver
     * @param _value amount of bridged tokens
     */
    function executeActionOnBridgedTokens(address _recipient, uint256 _value) internal {
        uint256 value = _unshiftValue(_value);
        bytes32 _messageId = messageId();

        _setMediatorBalance(mediatorBalance().sub(value));
        erc677token().safeTransfer(_recipient, value);

        emit TokensBridged(_recipient, value, _messageId);
    }

    /**
    * @dev Initiates the bridge operation that will lock the amount of tokens transferred and mint the tokens on
    * the other network. The user should first call Approve method of the ERC677 token.
    * @param _receiver address that will receive the minted tokens on the other network.
    * @param _value amount of tokens to be transferred to the other network.
    */
    function relayTokens(address _receiver, uint256 _value) external {
        // This lock is to prevent calling passMessage twice if a ERC677 token is used.
        // When transferFrom is called, after the transfer, the ERC677 token will call onTokenTransfer from this contract
        // which will call passMessage.
        require(!lock());
        ERC677 token = erc677token();
        require(withinLimit(_value));
        addTotalSpentPerDay(getCurrentDay(), _value);

        setLock(true);
        token.safeTransferFrom(msg.sender, _value);
        setLock(false);
        bridgeSpecificActionsOnTokenTransfer(token, msg.sender, _value, abi.encodePacked(_receiver));
    }

    /**
     * @dev Allows to send to the other network the amount of locked tokens that can be forced into the contract
     * without the invocation of the required methods.
     * @param _receiver the address that will receive the tokens on the other network
     */
    function fixMediatorBalance(address _receiver) external onlyIfUpgradeabilityOwner validAddress(_receiver) {
        uint256 balance = _erc677token().balanceOf(address(this));
        uint256 expectedBalance = mediatorBalance();
        require(balance > expectedBalance);
        uint256 diff = balance - expectedBalance;
        uint256 available = maxAvailablePerTx();
        require(available > 0);
        if (diff > available) {
            diff = available;
        }
        addTotalSpentPerDay(getCurrentDay(), diff);
        _setMediatorBalance(expectedBalance.add(diff));
        passMessage(_receiver, _receiver, diff);
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
            _setMediatorBalance(mediatorBalance().add(_value));
            passMessage(_from, chooseReceiver(_from, _data), _value);
        }
    }

    /**
    * @dev Unlock back the amount of tokens that were bridged to the other network but failed.
    * @param _recipient address that will receive the tokens
    * @param _value amount of tokens to be received
    */
    function executeActionOnFixedTokens(address _recipient, uint256 _value) internal {
        _setMediatorBalance(mediatorBalance().sub(_value));
        erc677token().safeTransfer(_recipient, _value);
    }

    /**
    * @dev Allows to transfer any locked token on this contract that is not part of the bridge operations.
    * @param _token address of the token, if it is not provided, native tokens will be transferred.
    * @param _to address that will receive the locked tokens on this contract.
    */
    function claimTokens(address _token, address _to) external onlyIfUpgradeabilityOwner {
        require(_token != address(_erc677token()));
        claimValues(_token, _to);
    }
}
