pragma solidity 0.4.24;

import "openzeppelin-solidity/contracts/AddressUtils.sol";

contract OwnableModule {
    address public owner;

    constructor(address _owner) public {
        owner = _owner;
    }

    modifier onlyOwner {
        require(msg.sender == owner);
        _;
    }

    function transferOwnership(address _newOwner) external onlyOwner {
        owner = _newOwner;
    }
}
