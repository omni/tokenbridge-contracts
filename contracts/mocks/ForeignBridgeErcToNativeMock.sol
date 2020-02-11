pragma solidity 0.4.24;

import "../upgradeable_contracts/erc20_to_native/ForeignBridgeErcToNative.sol";

contract ForeignBridgeErcToNativeMock is ForeignBridgeErcToNative {
    function migrationContract() internal pure returns (IScdMcdMigration) {
        // Address generated in unit test
        return IScdMcdMigration(0x44Bf5539DAAc4259f7F11A24280255ED2Fa3F7BF);
    }

    function halfDuplexErc20token() public pure returns (ERC20) {
        // Address generated in unit test
        return ERC20(0x872D709De609c391741c7595F0053F6060e59e0D);
    }

    function saiTopContract() internal pure returns (ISaiTop) {
        // Address generated in unit test
        return ISaiTop(0x96bc48adACdB60E6536E55a6727919a397F14540);
    }

    bytes32 internal constant CHAI_TOKEN_MOCK = 0x5d6f4e61a116947624416975e8d26d4aff8f32e21ea6308dfa35cee98ed41fd8; // keccak256(abi.encodePacked("chaiTokenMock"))

    function setChaiToken(IChai _chaiToken) external {
        addressStorage[CHAI_TOKEN_MOCK] = _chaiToken;
    }

    function chaiToken() public view returns (IChai) {
        return IChai(addressStorage[CHAI_TOKEN_MOCK]);
    }
}
