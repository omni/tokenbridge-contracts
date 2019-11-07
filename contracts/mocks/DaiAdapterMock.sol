pragma solidity 0.4.24;

contract DaiAdapterMock {
    address public dai;

    constructor(address _dai) public {
        dai = _dai;
    }
}
