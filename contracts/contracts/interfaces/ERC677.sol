pragma solidity 0.4.24;
import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";

contract ERC677 is ERC20 {
    event Transfer(address indexed from, address indexed to, uint256 value, bytes data);

    function transferAndCall(
        address,
        uint256,
        bytes
    ) external returns (bool);

    function increaseAllowance(address spender, uint256 addedValue) public returns (bool);

    function decreaseAllowance(address spender, uint256 subtractedValue) public returns (bool);
}

contract LegacyERC20 {
    function transfer(address _spender, uint256 _value) public; // returns (bool);

    function transferFrom(
        address _owner,
        address _spender,
        uint256 _value
    ) public; // returns (bool);
}
