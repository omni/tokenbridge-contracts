pragma solidity 0.4.24;

import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import "openzeppelin-solidity/contracts/AddressUtils.sol";
import "./BasicForeignBridge.sol";

contract ERC20Bridge is BasicForeignBridge {
    bytes32 internal constant ERC20_TOKEN = 0x15d63b18dbc21bf4438b7972d80076747e1d93c4f87552fe498c90cbde51665e; // keccak256(abi.encodePacked("erc20token"))

    function erc20token() public view returns (ERC20) {
        return ERC20(addressStorage[ERC20_TOKEN]);
    }

    function setErc20token(address _token) internal {
        require(AddressUtils.isContract(_token));
        addressStorage[ERC20_TOKEN] = _token;
    }

    function _relayTokens(address _sender, address _receiver, uint256 _amount) internal {
        require(_receiver != address(0));
        require(_receiver != address(this));
        require(_amount > 0);
        require(withinLimit(_amount));
        _increaseTotalSpentPerDay(_amount);

        erc20token().transferFrom(_sender, address(this), _amount);
        emit UserRequestForAffirmation(_receiver, _amount);
    }

    function relayTokens(address _from, address _receiver, uint256 _amount) external {
        require(_from == msg.sender || _from == _receiver);
        _relayTokens(_from, _receiver, _amount);
    }

    function relayTokens(address _receiver, uint256 _amount) external {
        _relayTokens(msg.sender, _receiver, _amount);
    }
}
