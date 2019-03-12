pragma solidity 0.4.19;


contract Sacrifice {
    function Sacrifice(address _recipient) public payable {
        selfdestruct(_recipient);
    }
}
