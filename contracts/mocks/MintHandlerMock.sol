pragma solidity 0.4.24;

import "../interfaces/IMintHandler.sol";
import "../interfaces/IBurnableMintableERC677Token.sol";
import "openzeppelin-solidity/contracts/ownership/Ownable.sol";

contract MintHandlerMock is IMintHandler, Ownable {
    IBurnableMintableERC677Token public token;

    mapping(address => bool) public isBridge;

    constructor(address _token) public {
        token = IBurnableMintableERC677Token(_token);
    }

    function addBridge(address _bridge) external onlyOwner {
        isBridge[_bridge] = true;
    }

    function removeBridge(address _bridge) external onlyOwner {
        delete isBridge[_bridge];
    }

    function mint(address _to, uint256 _amount) external returns (bool) {
        require(isBridge[msg.sender]);
        return token.mint(_to, _amount);
    }
}
