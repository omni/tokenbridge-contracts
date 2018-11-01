pragma solidity 0.4.24;

import "../../upgradeability/EternalStorage.sol";
import "../../libraries/SafeMath.sol";


contract BalanceHandler is EternalStorage {
    using SafeMath for uint256;

    address internal accountForAction = address(0);

    function depositForContractSender(address _contract) public payable {
        require(_contract != address(0));
        setBalanceOf(_contract, balanceOf(_contract).add(msg.value));
    }

    function withdrawFromDeposit(address _recipient) public {
        require(msg.sender == address(this));
        require(accountForAction != address(0));
        require(balanceOf(accountForAction) > 0);
        uint256 withdrawValue = balanceOf(accountForAction);
        setBalanceOf(accountForAction, 0);
        _recipient.transfer(withdrawValue);
        accountForAction = address(0);
    }

    function balanceOf(address _balanceHolder) public view returns(uint) {
        return uintStorage[keccak256(abi.encodePacked("balances", _balanceHolder))];
    }

    function setBalanceOf(address _balanceHolder, uint _amount) internal {
        uintStorage[keccak256(abi.encodePacked("balances", _balanceHolder))] = _amount;
    }

    function isWithdrawFromDepositSelector(bytes _data) internal pure returns(bool _retval) {
        _retval = false;
        bytes4 withdrawFromDepositSelector = this.withdrawFromDeposit.selector;
        if ((_data[0] == withdrawFromDepositSelector[0]) &&
        (_data[1] == withdrawFromDepositSelector[1]) &&
        (_data[2] == withdrawFromDepositSelector[2]) &&
            (_data[3] == withdrawFromDepositSelector[3])) {
            _retval = true;
        }
    }
}
