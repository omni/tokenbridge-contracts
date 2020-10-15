pragma solidity 0.4.24;

import "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "openzeppelin-solidity/contracts/AddressUtils.sol";

/**
* @title BaseMediatorFeeManager
* @dev Base fee manager to handle fees for AMB mediators.
*/
contract BaseMediatorFeeManager is Ownable {
    using SafeMath for uint256;

    event FeeUpdated(uint256 fee);

    // This is not a real fee value but a relative value used to calculate the fee percentage.
    // 1 ether = 100% of the value.
    uint256 internal constant MAX_FEE = 1 ether;
    uint256 internal constant MAX_REWARD_ACCOUNTS = 50;

    uint256 public fee;
    address[] internal rewardAccounts;
    address internal mediatorContract;

    modifier validFee(uint256 _fee) {
        require(_fee < MAX_FEE);
        /* solcov ignore next */
        _;
    }

    /**
    * @dev Stores the initial parameters of the fee manager.
    * @param _owner address of the owner of the fee manager contract.
    * @param _fee the fee percentage amount.
    * @param _rewardAccountList list of unique addresses that will receive the fee rewards.
    * @param _mediatorContract address of the mediator contract used together with this fee manager.
    */
    constructor(address _owner, uint256 _fee, address[] _rewardAccountList, address _mediatorContract) public {
        require(AddressUtils.isContract(_mediatorContract));
        require(_rewardAccountList.length > 0 && _rewardAccountList.length <= MAX_REWARD_ACCOUNTS);
        _transferOwnership(_owner);
        _setFee(_fee);
        mediatorContract = _mediatorContract;

        for (uint256 i = 0; i < _rewardAccountList.length; i++) {
            require(isValidAccount(_rewardAccountList[i]));
        }
        rewardAccounts = _rewardAccountList;
    }

    /**
    * @dev Calculates the fee amount to be subtracted from the value.
    * @param _value the base value from which fees are calculated
    */
    function calculateFee(uint256 _value) external view returns (uint256) {
        return _value.mul(fee).div(MAX_FEE);
    }

    /**
    * @dev Stores the fee percentage amount for the mediator operations.
    * @param _fee the fee percentage
    */
    function _setFee(uint256 _fee) internal validFee(_fee) {
        fee = _fee;
        emit FeeUpdated(_fee);
    }

    /**
    * @dev Sets the fee percentage amount for the mediator operations. Only the owner can call this method.
    * @param _fee the fee percentage
    */
    function setFee(uint256 _fee) external onlyOwner {
        _setFee(_fee);
    }

    function isValidAccount(address _account) internal returns (bool) {
        return _account != address(0) && _account != mediatorContract;
    }

    /**
    * @dev Adds a new account to the list of accounts to receive rewards for the operations.
    * Only the owner can call this method.
    * @param _account new reward account
    */
    function addRewardAccount(address _account) external onlyOwner {
        require(isValidAccount(_account));
        require(!isRewardAccount(_account));
        require(rewardAccounts.length < MAX_REWARD_ACCOUNTS);
        rewardAccounts.push(_account);
    }

    /**
    * @dev Removes an account from the list of accounts to receive rewards for the operations.
    * Only the owner can call this method.
    * finds the element, swaps it with the last element, and then deletes it;
    * @param _account to be removed
    * return boolean whether the element was found and deleted
    */
    function removeRewardAccount(address _account) external onlyOwner returns (bool) {
        uint256 numOfAccounts = rewardAccountsCount();
        for (uint256 i = 0; i < numOfAccounts; i++) {
            if (rewardAccounts[i] == _account) {
                rewardAccounts[i] = rewardAccounts[numOfAccounts - 1];
                delete rewardAccounts[numOfAccounts - 1];
                rewardAccounts.length--;
                return true;
            }
        }
        // If account is not found and removed, the transactions is reverted
        revert();
    }

    /**
    * @dev Tells the amount of accounts in the list of reward accounts.
    * @return amount of accounts.
    */
    function rewardAccountsCount() public view returns (uint256) {
        return rewardAccounts.length;
    }

    /**
    * @dev Tells if the account is part of the list of reward accounts.
    * @param _account to check if is part of the list.
    * @return true if the account is in the list
    */
    function isRewardAccount(address _account) internal view returns (bool) {
        for (uint256 i = 0; i < rewardAccountsCount(); i++) {
            if (rewardAccounts[i] == _account) {
                return true;
            }
        }
        return false;
    }

    /**
    * @dev Tells the list of accounts that receives rewards for the operations.
    * @return the list of reward accounts
    */
    function rewardAccountsList() public view returns (address[]) {
        return rewardAccounts;
    }

    /**
    * @dev ERC677 transfer callback function, received fee is distributed.
    * @param _value amount of transferred tokens
    */
    function onTokenTransfer(address, uint256 _value, bytes) external returns (bool) {
        distributeFee(_value);
        return true;
    }

    /**
    * @dev Distributes the provided amount of fees proportionally to the list of reward accounts.
    * In case the fees cannot be equally distributed, the remaining difference will be distributed to an account
    * in a semi-random way.
    * @param _fee total amount to be distributed to the list of reward accounts.
    */
    function distributeFee(uint256 _fee) internal {
        uint256 numOfAccounts = rewardAccountsCount();
        if (numOfAccounts == 0) {
            // In case there are no reward accounts defined, no actual fee distribution will happen.
            // Funds will be kept locked on the contract until some of the reward accounts will be added.
            // After it, locked funds ca be distributed by a call to onTokenTransfer() of this contract, which can be done by anyone.
            return;
        }
        uint256 feePerAccount = _fee.div(numOfAccounts);
        uint256 randomAccountIndex;
        uint256 diff = _fee.sub(feePerAccount.mul(numOfAccounts));
        if (diff > 0) {
            randomAccountIndex = random(numOfAccounts);
        }

        for (uint256 i = 0; i < numOfAccounts; i++) {
            uint256 feeToDistribute = feePerAccount;
            if (diff > 0 && randomAccountIndex == i) {
                feeToDistribute = feeToDistribute.add(diff);
            }
            onFeeDistribution(rewardAccounts[i], feeToDistribute);
        }
    }

    /**
    * @dev Calculates a random number based on the block number.
    * @param _count the max value for the random number.
    * @return a number between 0 and _count.
    */
    function random(uint256 _count) internal view returns (uint256) {
        return uint256(blockhash(block.number.sub(1))) % _count;
    }

    /* solcov ignore next */
    function onFeeDistribution(address _rewardAddress, uint256 _fee) internal;
}
