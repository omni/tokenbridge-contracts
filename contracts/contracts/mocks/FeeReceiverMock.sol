pragma solidity 0.4.24;

import "openzeppelin-solidity/contracts/token/ERC20/ERC20Basic.sol";

contract FeeReceiverMock {
    address public mediator;
    address public token;

    constructor(address _mediator, address _token) public {
        mediator = _mediator;
        token = _token;
    }

    function onTokenTransfer(
        address,
        uint256 _value,
        bytes
    ) external returns (bool) {
        ERC20Basic(token).transfer(mediator, _value);
        return true;
    }
}
