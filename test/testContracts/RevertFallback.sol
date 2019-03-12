pragma solidity 0.4.19;


contract RevertFallback {
    function () public payable {
        revert();
    }

    function receiveEth() public payable {

    }
}
