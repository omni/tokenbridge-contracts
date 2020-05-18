pragma solidity 0.4.24;

import "../libraries/Address.sol";

contract RevertFallback {
    function() public payable {
        revert();
    }

    function receiveEth() public payable {
        // solhint-disable-previous-line no-empty-blocks
    }

    function sendEth(address _receiver, uint256 _value) public {
        // solhint-disable-next-line check-send-result
        require(_receiver.send(_value));
    }

    function safeSendEth(address _receiver, uint256 _value) public {
        Address.safeSendValue(_receiver, _value);
    }
}
