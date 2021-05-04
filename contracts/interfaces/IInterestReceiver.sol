pragma solidity 0.4.24;

interface IInterestReceiver {
    function onInterestReceived(address _token) external;
}
