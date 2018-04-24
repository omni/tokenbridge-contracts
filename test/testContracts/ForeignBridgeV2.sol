pragma solidity ^0.4.19;


import "../../contracts/upgradeable_contracts/U_ForeignBridge.sol";


interface OwnableToken {
    function transferOwnership(address) public;
}

contract ForeignBridgeV2 is ForeignBridge {
    function changeTokenOwnership(address _newTokenOwner) public onlyOwner {
        address token = address(erc677token());
        OwnableToken poa = OwnableToken(token);
        poa.transferOwnership(_newTokenOwner);
    }
}
