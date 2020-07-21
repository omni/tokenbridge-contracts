pragma solidity 0.4.24;

import "../../interfaces/IAMB.sol";
import "./MultiTokenBridgeMediator.sol";
import "../Ownable.sol";
import "../Initializable.sol";
import "../ReentrancyGuard.sol";
import "../Upgradeable.sol";
import "../Claimable.sol";
import "../VersionableBridge.sol";

/**
* @title BasicMultiAMBErc20ToErc677
* @dev Common functionality for multi-erc20-to-erc677 mediator intended to work on top of AMB bridge.
*/
contract BasicMultiAMBErc20ToErc677 is
    Initializable,
    ReentrancyGuard,
    Upgradeable,
    Claimable,
    VersionableBridge,
    MultiTokenBridgeMediator
{
    function bridgeContractOnOtherSide() internal view returns (address) {
        return mediatorContractOnOtherSide();
    }

    function relayTokens(ERC677 token, address _from, address _receiver, uint256 _value) external {
        require(_from == msg.sender || _from == _receiver);
        _relayTokens(token, _from, _receiver, _value);
    }

    function relayTokens(ERC677 token, address _receiver, uint256 _value) external {
        _relayTokens(token, msg.sender, _receiver, _value);
    }

    function getBridgeInterfacesVersion() external pure returns (uint64 major, uint64 minor, uint64 patch) {
        return (1, 0, 0);
    }

    function getBridgeMode() external pure returns (bytes4 _data) {
        return 0xb1516c26; // bytes4(keccak256(abi.encodePacked("multi-erc-to-erc-amb")))
    }

    function claimTokens(address _token, address _to) public onlyIfUpgradeabilityOwner validAddress(_to) {
        require(minPerTx(_token) == 0); // token not registered
        claimValues(_token, _to);
    }

    function onTokenTransfer(address _from, uint256 _value, bytes _data) public returns (bool) {
        ERC677 token = ERC677(msg.sender);
        if (!lock()) {
            require(withinLimit(token, _value));
            addTotalSpentPerDay(token, getCurrentDay(), _value);
        }
        bridgeSpecificActionsOnTokenTransfer(token, _from, _value, _data);
        return true;
    }

    function _relayTokens(ERC677 token, address _from, address _receiver, uint256 _value) internal {
        // This lock is to prevent calling passMessage twice if a ERC677 token is used.
        // When transferFrom is called, after the transfer, the ERC677 token will call onTokenTransfer from this contract
        // which will call passMessage.
        require(!lock());
        address to = address(this);
        require(withinLimit(token, _value));
        addTotalSpentPerDay(token, getCurrentDay(), _value);

        setLock(true);
        token.transferFrom(_from, to, _value);
        setLock(false);
        bridgeSpecificActionsOnTokenTransfer(token, _from, _value, abi.encodePacked(_receiver));
    }

    /* solcov ignore next */
    function bridgeSpecificActionsOnTokenTransfer(ERC677 _token, address _from, uint256 _value, bytes _data) internal;
}
