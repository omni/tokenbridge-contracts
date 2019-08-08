pragma solidity 0.4.24;

import "../../upgradeability/EternalStorage.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";

contract BalanceHandler is EternalStorage {
    using SafeMath for uint256;

    bytes32 internal constant ACCOUNT_FOR_ACTION = keccak256(abi.encodePacked("accountForAction"));

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
        return addressStorage[ACCOUNT_FOR_ACTION];
    }

    function setAccountForAction(address _account) internal {
        addressStorage[ACCOUNT_FOR_ACTION] = _account;
    }

    function isWithdrawFromDepositSelector(bytes _data) internal pure returns (bool) {
        bytes4 selector = this.withdrawFromDeposit.selector;
        if (
            (_data[0] == selector[0]) &&
            (_data[1] == selector[1]) &&
            (_data[2] == selector[2]) &&
            (_data[3] == selector[3])
        ) {
            return true;
        }
        return false;
    }
}
