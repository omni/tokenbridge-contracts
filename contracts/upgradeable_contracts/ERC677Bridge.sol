pragma solidity 0.4.24;

import "./BaseERC677Bridge.sol";
import "../libraries/Bytes.sol";

contract ERC677Bridge is BaseERC677Bridge {
    function getReceiver(address _from, bytes _data) internal view returns (address recipient) {
        recipient = _from;
        if (_data.length == 20) {
            recipient = Bytes.bytesToAddress(_data);
        }
        require(recipient != address(0));
    }

    function bridgeSpecificActionsOnTokenTransfer(
        ERC677, /*_token*/
        address _from,
        uint256 _value,
        bytes _data
    ) internal {
        fireEventOnTokenTransfer(getReceiver(_from, _data), _value);
    }

    /* solcov ignore next */
    function fireEventOnTokenTransfer(address _from, uint256 _value) internal;
}
