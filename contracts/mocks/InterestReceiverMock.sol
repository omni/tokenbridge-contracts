pragma solidity 0.4.24;

import "../upgradeable_contracts/InterestReceiver.sol";

contract InterestReceiverMock is InterestReceiver {
    address private chaiTokenMock;
    address private daiTokenMock;

    // solhint-disable no-empty-blocks
    constructor(address _owner, address _bridge, address _xDaiReceiver)
        public
        InterestReceiver(_owner, _bridge, _xDaiReceiver)
    {}
    // solhint-enable no-empty-blocks

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
