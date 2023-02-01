pragma solidity 0.4.24;

contract TelepathyForeignApprover {
    address telepathyTargetAMB;
    address homeOmnibridgeAMB;

    mapping(bytes32 => bool) public approvals;

    constructor(address _telepathyTargetAMB, address _homeOmnibridgeAMB) {
        telepathyTargetAMB = _telepathyTargetAMB;
        homeOmnibridgeAMB = _homeOmnibridgeAMB;
    }

    function receiveSuccinct(address srcAddress, bytes message) external {
        require(msg.sender == telepathyTargetAMB, "Only Succinct AMB can call this function");
        require(srcAddress == homeOmnibridgeAMB, "Only other side AMB can pass a message call to this contract.");
        bytes32 messageId = keccak256(message);
        approvals[messageId] = true;
    }
}