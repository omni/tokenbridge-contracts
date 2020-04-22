pragma solidity 0.4.24;

import "../upgradeable_contracts/arbitrary_message/ForeignAMB.sol";
import "../upgradeable_contracts/arbitrary_message/HomeAMB.sol";

contract ForeignAMBWithOldStorage is ForeignAMB {
    function oldSetFailedMessageDataHash(bytes32 _txHash, bytes data) external {
        bytesStorage[keccak256(abi.encodePacked("failedMessageDataHash", _txHash))] = abi.encodePacked(keccak256(data));
    }
}

contract HomeAMBWithOldStorage is HomeAMB {
    function oldSetFailedMessageDataHash(bytes32 _txHash, bytes data) external {
        bytesStorage[keccak256(abi.encodePacked("failedMessageDataHash", _txHash))] = abi.encodePacked(keccak256(data));
    }
}
