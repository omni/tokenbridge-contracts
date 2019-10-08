pragma solidity 0.4.24;

import "./ERC677Bridge.sol";
import "../interfaces/IBurnableMintableERC677Token.sol";
import "../libraries/Bytes.sol";
import "./OtherSideBridgeStorage.sol";

contract ERC677BridgeForBurnableMintableToken is ERC677Bridge, OtherSideBridgeStorage {
    function getReceiver(address _from, bytes _data) internal view returns (address recipient) {
        recipient = _from;
        if (_data.length == 20) {
            recipient = Bytes.bytesToAddress(_data);
        }
        require(recipient != address(0));
        require(recipient != bridgeContractOnOtherSide());
    }

    function bridgeSpecificActionsOnTokenTransfer(ERC677 _token, address _from, uint256 _value, bytes _data) internal {
        IBurnableMintableERC677Token(_token).burn(_value);
        fireEventOnTokenTransfer(getReceiver(_from, _data), _value);
    }
}
