pragma solidity 0.4.24;

contract SaiTopMock {
    uint256 public caged;

    function setCaged(uint256 _value) public {
        caged = _value;
    }
}
