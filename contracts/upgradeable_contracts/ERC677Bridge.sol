pragma solidity 0.4.24;

import "./BasicBridge.sol";
import "../interfaces/ERC677.sol";
import "../interfaces/ERC677Receiver.sol";
import "./ERC677Storage.sol";

contract ERC677Bridge is BasicBridge, ERC677Receiver, ERC677Storage {
    function erc677token() public view returns (ERC677) {
        return ERC677(addressStorage[ERC677_TOKEN]);
    }

    function setErc677token(address _token) internal {
        require(AddressUtils.isContract(_token));
        addressStorage[ERC677_TOKEN] = _token;
    }

    function onTokenTransfer(
        address _from,
        uint256 _value,
        bytes /*_data*/
    ) external returns (bool) {
        ERC677 token = erc677token();
        require(msg.sender == address(token));
        require(withinLimit(_value));
        setTotalSpentPerDay(getCurrentDay(), totalSpentPerDay(getCurrentDay()).add(_value));
        bridgeSpecificActionsOnTokenTransfer(token, _from, _value);
        return true;
    }

    function bridgeSpecificActionsOnTokenTransfer(
        ERC677, /*_token*/
        address _from,
        uint256 _value
    ) internal {
        fireEventOnTokenTransfer(_from, _value);
    }

    /* solcov ignore next */
    function fireEventOnTokenTransfer(address _from, uint256 _value) internal;
}
