pragma solidity 0.4.24;

contract UtopiaBox {
    uint256 public value;

    function setValue(uint256 _value) public {
        value = _value;
    }

    function methodWillFail() public {
        revert();
    }

    function methodOutOfGas() public {
        uint256 a = 0;
        for (uint256 i = 0; i < 1000; i++) {
            a = a + i;
        }
    }
}
