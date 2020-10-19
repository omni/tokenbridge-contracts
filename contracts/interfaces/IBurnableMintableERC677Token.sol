pragma solidity 0.4.24;
import "../interfaces/ERC677.sol";

contract IBurnableMintableERC677Token is ERC677 {
    function mint(address _to, uint256 _amount) public returns (bool);
    function burn(uint256 _value) public;
    function claimTokens(address _token, address _to) external;
}
