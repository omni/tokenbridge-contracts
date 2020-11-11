pragma solidity 0.4.24;

import "openzeppelin-solidity/contracts/AddressUtils.sol";
import "./OwnableModule.sol";

/**
 * @title MediatorOwnableModule
 * @dev Common functionality for multi-token extension non-upgradeable module.
 */
contract MediatorOwnableModule is OwnableModule {
    address public mediator;

    /**
     * @dev Initializes this contract.
     * @param _mediator address of the deployed multi-token extension for which this module is deployed.
     * @param _owner address of the owner that is allowed to perform additional actions on the particular module.
     */
    constructor(address _mediator, address _owner) public OwnableModule(_owner) {
        require(AddressUtils.isContract(_mediator));
        mediator = _mediator;
    }

    /**
     * @dev Throws if sender is not the multi-token extension.
     */
    modifier onlyMediator {
        require(msg.sender == mediator);
        _;
    }
}
