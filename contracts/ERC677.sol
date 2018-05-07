pragma solidity 0.4.21;
import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";


contract ERC677 is ERC20 {
    event Transfer(address indexed from, address indexed to, uint value, bytes data);

    function transferAndCall(address, uint, bytes) external returns (bool);

}
