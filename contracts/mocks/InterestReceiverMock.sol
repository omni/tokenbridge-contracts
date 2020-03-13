pragma solidity 0.4.24;

import "../upgradeable_contracts/InterestReceiver.sol";

contract InterestReceiverMock is InterestReceiver {
    address private chaiTokenMock;
    address private daiTokenMock;

    // solhint-disable-next-line no-empty-blocks
    constructor(address _owner) public InterestReceiver(_owner) {}

    function setChaiToken(IChai _chaiToken) external {
        chaiTokenMock = _chaiToken;
        daiTokenMock = _chaiToken.daiToken();
    }

    function chaiToken() public view returns (IChai) {
        return IChai(chaiTokenMock);
    }

    function daiToken() public view returns (ERC20) {
        return ERC20(daiTokenMock);
    }
}
