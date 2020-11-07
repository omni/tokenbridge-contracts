pragma solidity 0.7.4;

import "../interfaces/IBasicAMBMediator.sol";
import "./TokenProxy.sol";

contract TokenFactory {
    address public tokenImage;

    constructor (address _tokenImage) {
        tokenImage = _tokenImage;
    }

    function deployToken(
        address _originalToken,
        string calldata _name,
        string calldata _symbol,
        uint8 _decimals
    ) external returns (address) {
        IAMB bridge = IBasicAMBMediator(msg.sender).bridgeContract();
        uint256 destinationChainId = bridge.destinationChainId();
        bytes32 salt = keccak256(abi.encodePacked(msg.sender, destinationChainId, _originalToken));
        return address(new TokenProxy{salt: salt}(tokenImage, _name, _symbol, _decimals, msg.sender));
    }
}
