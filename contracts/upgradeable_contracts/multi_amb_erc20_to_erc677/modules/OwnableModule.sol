pragma solidity 0.4.24;

import "openzeppelin-solidity/contracts/AddressUtils.sol";
import "../../Ownable.sol";

contract OwnableModule {
    Ownable public mediator;

    constructor(address _mediator) public {
        require(AddressUtils.isContract(_mediator));
        mediator = Ownable(_mediator);
    }

    modifier onlyMediator {
        require(msg.sender == address(mediator));
        _;
    }

    modifier onlyOwner {
        require(msg.sender == mediator.owner());
        _;
    }
}
