pragma solidity 0.4.24;

import "../../interfaces/ERC677.sol";
import "../../libraries/SafeERC20.sol";
import "../ReentrancyGuard.sol";
import "../ChooseReceiverHelper.sol";
import "../BasicAMBMediator.sol";

/**
* @title MultiTokenRelayer
* @dev Common functionality for bridging multiple tokens to the other side of the bridge.
*/
contract MultiTokenRelayer is BasicAMBMediator, ReentrancyGuard, ChooseReceiverHelper {
    using SafeERC20 for ERC677;

    /**
    * @dev ERC677 transfer callback function.
    * @param _from address of tokens sender.
    * @param _value amount of transferred tokens.
    * @param _data additional transfer data, can be used for passing alternative receiver address.
    */
    function onTokenTransfer(address _from, uint256 _value, bytes _data) public returns (bool) {
        if (!lock()) {
            ERC677 token = ERC677(msg.sender);
            bridgeSpecificActionsOnTokenTransfer(token, _from, chooseReceiver(_from, _data), _value);
        }
        return true;
    }

    /**
    * @dev Initiate the bridge operation for some amount of tokens from msg.sender.
    * The user should first call Approve method of the ERC677 token.
    * @param token bridged token contract address.
    * @param _receiver address that will receive the native tokens on the other network.
    * @param _value amount of tokens to be transferred to the other network.
    */
    function relayTokens(ERC677 token, address _receiver, uint256 _value) external {
        _relayTokens(token, _receiver, _value);
    }

    /**
    * @dev Initiate the bridge operation for some amount of tokens from msg.sender to msg.sender on the other side.
    * The user should first call Approve method of the ERC677 token.
    * @param token bridged token contract address.
    * @param _value amount of tokens to be transferred to the other network.
    */
    function relayTokens(ERC677 token, uint256 _value) external {
        _relayTokens(token, msg.sender, _value);
    }

    /**
    * @dev Tells the address of the mediator contract on the other side, used by chooseReceiver method
    * to avoid sending the native tokens to that address.
    * @return address of the mediator contract con the other side
    */
    function bridgeContractOnOtherSide() internal view returns (address) {
        return mediatorContractOnOtherSide();
    }

    /**
    * @dev Validates that the token amount is inside the limits, calls transferFrom to transfer the tokens to the contract
    * and invokes the method to burn/lock the tokens and unlock/mint the tokens on the other network.
    * The user should first call Approve method of the ERC677 token.
    * @param token bridge token contract address.
    * @param _receiver address that will receive the native tokens on the other network.
    * @param _value amount of tokens to be transferred to the other network.
    */
    function _relayTokens(ERC677 token, address _receiver, uint256 _value) internal {
        // This lock is to prevent calling passMessage twice if a ERC677 token is used.
        // When transferFrom is called, after the transfer, the ERC677 token will call onTokenTransfer from this contract
        // which will call passMessage.
        require(!lock());

        setLock(true);
        token.safeTransferFrom(msg.sender, _value);
        setLock(false);
        bridgeSpecificActionsOnTokenTransfer(token, msg.sender, _receiver, _value);
    }

    /* solcov ignore next */
    function bridgeSpecificActionsOnTokenTransfer(ERC677 _token, address _from, address _receiver, uint256 _value)
        internal;
}
