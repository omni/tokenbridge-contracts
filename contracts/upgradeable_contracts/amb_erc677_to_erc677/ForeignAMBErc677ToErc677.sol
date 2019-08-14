pragma solidity 0.4.24;

import "./BasicAMBErc677ToErc677.sol";
import "../ERC677Bridge.sol";
import "openzeppelin-solidity/contracts/AddressUtils.sol";

contract ForeignAMBErc677ToErc677 is BasicAMBErc677ToErc677 {
    function handleBridgedTokens(address _recipient, uint256 _value) external {
        validBridgedTokens(_value);
        erc677token().transfer(_recipient, _value);
    }
}
