pragma solidity 0.4.24;

import "./BaseERC677Bridge.sol";
import "./OtherSideBridgeStorage.sol";

contract ERC677Bridge is BaseERC677Bridge, OtherSideBridgeStorage {
    function erc677token() public view returns (ERC677) {
        return _erc677token();
    }

    function bridgeSpecificActionsOnTokenTransfer(
        ERC677, /*_token*/
        address _from,
        uint256 _value,
        bytes _data
    ) internal {
        fireEventOnTokenTransfer(chooseReceiver(_from, _data), _value);
    }

    /* solcov ignore next */
    function fireEventOnTokenTransfer(address _from, uint256 _value) internal;
}
