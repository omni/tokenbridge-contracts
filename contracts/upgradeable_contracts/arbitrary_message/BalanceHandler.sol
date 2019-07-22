pragma solidity 0.4.24;

import "../../upgradeability/EternalStorage.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";

contract BalanceHandler is EternalStorage {
    using SafeMath for uint256;

    function depositForContractSender(address _contract) public payable {
        require(_contract != address(0));
        setBalanceOf(_contract, balanceOf(_contract).add(msg.value));
    }

    function withdrawFromDeposit(address _recipient) public {
        require(msg.sender == address(this));
        address account = accountForAction();
        require(account != address(0));
        require(balanceOf(account) > 0);
        uint256 withdrawValue = balanceOf(account);
        setBalanceOf(account, 0);
        _recipient.transfer(withdrawValue);
        setAccountForAction(address(0));
    }

    function balanceOf(address _balanceHolder) public view returns (uint256) {
        return uintStorage[keccak256(abi.encodePacked("balances", _balanceHolder))];
    }

    function setBalanceOf(address _balanceHolder, uint256 _amount) internal {
        uintStorage[keccak256(abi.encodePacked("balances", _balanceHolder))] = _amount;
    }

    function accountForAction() internal view returns (address) {
        return addressStorage[keccak256(abi.encodePacked("accountForAction"))];
    }

    function setAccountForAction(address _account) internal {
        addressStorage[keccak256(abi.encodePacked("accountForAction"))] = _account;
    }

    function isWithdrawFromDepositSelector(bytes _data) internal pure returns (bool _retval) {
        _retval = false;
        bytes4 withdrawFromDepositSelector = this.withdrawFromDeposit.selector;
        if (
            (_data[0] == withdrawFromDepositSelector[0]) &&
            (_data[1] == withdrawFromDepositSelector[1]) &&
            (_data[2] == withdrawFromDepositSelector[2]) &&
            (_data[3] == withdrawFromDepositSelector[3])
        ) {
            _retval = true;
        }
    }
}
