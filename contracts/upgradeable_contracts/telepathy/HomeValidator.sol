pragma solidity 0.4.24;

interface IHomeOmnibridgeAMB {
    function executeAffirmation(bytes message) external;
}

contract TelepathyHomeValidator {
    address telepathyTargetAMB;
    address homeOmnibridgeAMB;
    address foreignOmnibridgeAMB;

    constructor(address _telepathyTargetAMB, address _homeOmnibridgeAMB, address _foreignOmnibridgeAMB) {
        telepathyTargetAMB = _telepathyTargetAMB;
        homeOmnibridgeAMB = _homeOmnibridgeAMB;
        foreignOmnibridgeAMB = _foreignOmnibridgeAMB;
    }

    function receiveSuccinct(address srcAddress, bytes message) external {
        require(msg.sender == telepathyTargetAMB, "Only Succinct AMB can call this function");
        require(srcAddress == foreignOmnibridgeAMB, "Only other side AMB can pass a message call to this contract.");
        IHomeOmnibridgeAMB(homeOmnibridgeAMB).executeAffirmation(message);
    }
}