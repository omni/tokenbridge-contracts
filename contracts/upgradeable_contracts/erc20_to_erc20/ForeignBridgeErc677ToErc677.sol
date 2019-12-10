pragma solidity 0.4.24;

import "./BasicForeignBridgeErcToErc.sol";
import "../ERC677Bridge.sol";

contract ForeignBridgeErc677ToErc677 is ERC677Bridge, BasicForeignBridgeErcToErc {
    function erc20token() public view returns (ERC20) {
        return erc677token();
    }

    function setErc20token(address _token) internal {
        setErc677token(_token);
    }

    function fireEventOnTokenTransfer(address _from, uint256 _value) internal {
        emit UserRequestForAffirmation(_from, _value);
    }
}
