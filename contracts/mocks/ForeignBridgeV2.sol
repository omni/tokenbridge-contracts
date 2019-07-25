pragma solidity 0.4.24;

import "../upgradeable_contracts/native_to_erc20/ForeignBridgeNativeToErc.sol";

interface OwnableToken {
    function transferOwnership(address) external;
}

contract ForeignBridgeV2 is ForeignBridgeNativeToErc {
    function changeTokenOwnership(address _newTokenOwner) public onlyOwner {
        address token = address(erc677token());
        OwnableToken poa = OwnableToken(token);
        poa.transferOwnership(_newTokenOwner);
    }
    // used for testing
    address public something;
    function doSomething(address _newTokenOwner) public onlyOwner {
        something = _newTokenOwner;
    }
}
