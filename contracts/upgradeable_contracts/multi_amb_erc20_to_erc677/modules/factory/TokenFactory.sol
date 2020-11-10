pragma solidity 0.4.24;

import "./TokenProxy.sol";

contract TokenFactory {
    address public tokenImage;

    constructor(address _tokenImage) public {
        tokenImage = _tokenImage;
    }

    function deploy(string _name, string _symbol, uint8 _decimals, uint256 _chainId) external returns (address) {
        return new TokenProxy(tokenImage, _name, _symbol, _decimals, _chainId, msg.sender);
    }
}
