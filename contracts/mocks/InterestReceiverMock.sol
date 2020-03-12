pragma solidity 0.4.24;

import "../upgradeable_contracts/InterestReceiver.sol";

contract InterestReceiverMock is InterestReceiver {
    bytes32 internal constant CHAI_TOKEN_MOCK = 0x5d6f4e61a116947624416975e8d26d4aff8f32e21ea6308dfa35cee98ed41fd8; // keccak256(abi.encodePacked("chaiTokenMock"))
    bytes32 internal constant DAI_TOKEN_MOCK = 0xbadb505d38473a045eb3ce02f80bb0c4b30c429923cd667bca7f33083bad4e14; // keccak256(abi.encodePacked("daiTokenMock"))

    function setChaiToken(IChai _chaiToken) external {
        addressStorage[CHAI_TOKEN_MOCK] = _chaiToken;
        addressStorage[DAI_TOKEN_MOCK] = _chaiToken.daiToken();
    }

    function chaiToken() public view returns (IChai) {
        return IChai(addressStorage[CHAI_TOKEN_MOCK]);
    }

    function daiToken() public view returns (ERC20) {
        return ERC20(addressStorage[DAI_TOKEN_MOCK]);
    }
}
