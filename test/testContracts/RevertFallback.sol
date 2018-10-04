pragma solidity 0.4.24;


contract RevertFallback {
    function () public payable {
        revert();
    }

    function receiveEth() public payable {

    }
}
