pragma solidity 0.4.24;

import "./Interfaces.sol";

contract TelepathyHomeValidator {
    bool public initialized = false;
    address public homeTelepathyReceiver;
    address public homeOmnibridgeAMB;
    address public foreignOmnibridgeAMB;

    function initialize(address _homeTelepathyReceiver, address _homeOmnibridgeAMB, address _foreignOmnibridgeAMB) {
        require(!initialized);
        homeTelepathyReceiver = _homeTelepathyReceiver;
        homeOmnibridgeAMB = _homeOmnibridgeAMB;
        foreignOmnibridgeAMB = _foreignOmnibridgeAMB;
        initialized = true;
    }

    function receiveSuccinct(address srcAddress, bytes message) external {
        require(msg.sender == homeTelepathyReceiver);
        require(srcAddress == foreignOmnibridgeAMB);
        IHomeOmnibridgeAMB(homeOmnibridgeAMB).executeAffirmation(message);
    }
}