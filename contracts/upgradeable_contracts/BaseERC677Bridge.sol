pragma solidity 0.4.24;

import "openzeppelin-solidity/contracts/AddressUtils.sol";
import "./BasicTokenBridge.sol";
import "../interfaces/ERC677.sol";
import "../interfaces/ERC677Receiver.sol";
import "./ERC677Storage.sol";
import "./ChooseReceiverHelper.sol";

contract BaseERC677Bridge is BasicTokenBridge, ERC677Receiver, ERC677Storage, ChooseReceiverHelper {
    function _erc677token() internal view returns (ERC677) {
        return ERC677(addressStorage[ERC677_TOKEN]);
    }

    function setErc677token(address _token) internal {
        require(AddressUtils.isContract(_token));
        addressStorage[ERC677_TOKEN] = _token;
    }

    function onTokenTransfer(address _from, uint256 _value, bytes _data) external returns (bool) {
        ERC677 token = _erc677token();
        require(msg.sender == address(token));
        require(withinLimit(_value));
        addTotalSpentPerDay(getCurrentDay(), _value);
        bridgeSpecificActionsOnTokenTransfer(token, _from, _value, _data);
        return true;
    }

    /* solcov ignore next */
    function bridgeSpecificActionsOnTokenTransfer(ERC677 _token, address _from, uint256 _value, bytes _data) internal;
}
