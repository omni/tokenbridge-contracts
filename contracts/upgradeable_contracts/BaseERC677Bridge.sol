pragma solidity 0.4.24;

import "openzeppelin-solidity/contracts/AddressUtils.sol";
import "./BasicTokenBridge.sol";
import "../interfaces/ERC677.sol";
import "../interfaces/ERC677Receiver.sol";
import "./ERC677Storage.sol";
import "../libraries/Bytes.sol";

contract BaseERC677Bridge is BasicTokenBridge, ERC677Receiver, ERC677Storage {
    function erc677token() public view returns (ERC677) {
        return ERC677(addressStorage[ERC677_TOKEN]);
    }

    function setErc677token(address _token) internal {
        require(AddressUtils.isContract(_token));
        addressStorage[ERC677_TOKEN] = _token;
    }

    function onTokenTransfer(address _from, uint256 _value, bytes _data) public returns (bool) {
        ERC677 token = erc677token();
        require(msg.sender == address(token));
        _updateTodayLimit();
        require(withinLimit(_value));
        _increaseTotalSpentPerDay(_value);
        bridgeSpecificActionsOnTokenTransfer(token, _from, _value, _data);
        return true;
    }

    function chooseReceiver(address _from, bytes _data) internal view returns (address recipient) {
        recipient = _from;
        if (_data.length > 0) {
            require(_data.length == 20);
            recipient = Bytes.bytesToAddress(_data);
            require(recipient != address(0));
            require(recipient != bridgeContractOnOtherSide());
        }
    }

    /* solcov ignore next */
    function bridgeSpecificActionsOnTokenTransfer(ERC677 _token, address _from, uint256 _value, bytes _data) internal;

    /* solcov ignore next */
    function bridgeContractOnOtherSide() internal view returns (address);
}
