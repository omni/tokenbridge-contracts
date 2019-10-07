pragma solidity 0.4.24;

import "./BaseERC677Bridge.sol";

contract ERC677Bridge is BaseERC677Bridge {
    function bridgeSpecificActionsOnTokenTransfer(
        ERC677, /*_token*/
        address _from,
        uint256 _value,
        bytes /*_data*/
    ) internal {
        fireEventOnTokenTransfer(_from, _value);
    }

    /* solcov ignore next */
    function fireEventOnTokenTransfer(address _from, uint256 _value) internal;
}
