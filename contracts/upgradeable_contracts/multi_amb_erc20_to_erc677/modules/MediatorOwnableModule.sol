pragma solidity 0.4.24;

import "openzeppelin-solidity/contracts/AddressUtils.sol";
import "./OwnableModule.sol";

contract MediatorOwnableModule is OwnableModule {
    address public mediator;

    constructor(address _mediator, address _owner) public OwnableModule(_owner) {
        require(AddressUtils.isContract(_mediator));
        mediator = _mediator;
    }

    modifier onlyMediator {
        require(msg.sender == mediator);
        _;
    }
}
