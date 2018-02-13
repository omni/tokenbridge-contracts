pragma solidity 0.4.19;
import "zeppelin-solidity/contracts/token/ERC827/ERC827.sol";


contract IBurnableMintableERC827Token is ERC827 {
    function mint(address, uint256) public returns (bool);
    function burn(uint256 _value) public;
}