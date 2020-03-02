pragma solidity 0.4.24;

import "../upgradeable_contracts/InterestReceiver.sol";

contract InterestReceiverMock is InterestReceiver {
    bytes32 internal constant CHAI_TOKEN_MOCK = 0x5d6f4e61a116947624416975e8d26d4aff8f32e21ea6308dfa35cee98ed41fd8; // keccak256(abi.encodePacked("chaiTokenMock"))

    function setChaiToken(IChai _chaiToken) external {
        addressStorage[CHAI_TOKEN_MOCK] = _chaiToken;
    }

    function chaiToken() public view returns (IChai) {
        return IChai(addressStorage[CHAI_TOKEN_MOCK]);
    }
}
