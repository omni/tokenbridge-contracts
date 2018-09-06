pragma solidity 0.4.24;

import "./BasicHomeAMB.sol";
import "./BasicForeignAMB.sol";


contract ForeignAMB is BasicForeignAMB {

    function depositForContractSender(address _contract) public payable {
        require(_contract != address(0));
        setBalanceOf(_contract, balanceOf(_contract).add(msg.value));
    }
}
