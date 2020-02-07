pragma solidity 0.4.24;

import "../upgradeability/EternalStorage.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";

/**
* @title BaseMediatorFeeManager
* @dev Common functionality of fee managers for AMB mediators to store, calculate and perform actions related to
* fee distribution. The fee manager is used as a logic contract only, the state variables are stored in the mediator
* contract, so methods should be invoked by using delegatecall or callcode.
*/
contract BaseMediatorFeeManager is EternalStorage {
    using SafeMath for uint256;

    event FeeUpdated(uint256 fee);

    // This is not a real fee value but a relative value used to calculate the fee percentage.
    // 1 ether = 100% of the value.
    uint256 internal constant MAX_FEE = 1 ether;
    bytes32 internal constant FEE_STORAGE_KEY = 0x833b9f6abf0b529613680afe2a00fa663cc95cbdc47d726d85a044462eabbf02; // keccak256(abi.encodePacked("fee"))
    bytes32 internal constant REWARD_ACCOUNTS_COUNT = 0x7a0619a0d97f7e9c83d1a6c44be033aecca1245b900bb0e97a7dcaae387eb874; // keccak256(abi.encodePacked("rewardAccountCount"))
    address internal constant F_ADDR = 0xFFfFfFffFFfffFFfFFfFFFFFffFFFffffFfFFFfF;
    uint256 internal constant MAX_REWARD_ACCOUNTS = 50;

    modifier validFee(uint256 _fee) {
        require(_fee < MAX_FEE);
        /* solcov ignore next */
        _;
    }

    /**
    * @dev Initialize the list of accounts that receives rewards for the mediator operations.
    * The list of accounts is stored as a Linked List where the list starts and ends at F_ADDR.
    * Example: F_ADDR -> account1; account1 -> account2; account2 -> F_ADDR
    * @param _accounts list of accounts
    */
    function initializeRewardAccounts(address[] _accounts) public {
        for (uint256 i = 0; i < _accounts.length; i++) {
            require(_accounts[i] != address(0) && _accounts[i] != F_ADDR);
            require(!isRewardAccount(_accounts[i]));

            if (i == 0) {
                setNextRewardAccount(F_ADDR, _accounts[i]);
                if (_accounts.length == 1) {
                    setNextRewardAccount(_accounts[i], F_ADDR);
                }
            } else if (i == _accounts.length - 1) {
                setNextRewardAccount(_accounts[i - 1], _accounts[i]);
                setNextRewardAccount(_accounts[i], F_ADDR);
            } else {
                setNextRewardAccount(_accounts[i - 1], _accounts[i]);
            }
        }

        setRewardAccountsCount(_accounts.length);
    }

    /**
    * @dev Tells the list of accounts that receives rewards for the operations.
    * @return the list of reward accounts
    */
    function rewardAccounts() external view returns (address[] memory) {
        address[] memory list = new address[](rewardAccountsCount());
        uint256 counter = 0;
        address nextRewardAccount = getNextRewardAccount(F_ADDR);
        require(nextRewardAccount != address(0));

        while (nextRewardAccount != F_ADDR) {
            list[counter] = nextRewardAccount;
            nextRewardAccount = getNextRewardAccount(nextRewardAccount);
            counter++;

            require(nextRewardAccount != address(0));
        }

        return list;
    }

    /**
    * @dev Calculates the fee amount to be subtracted from the value.
    * @param _value the base value from which fees are calculated
    */
    function calculateFee(uint256 _value) external view returns (uint256) {
        uint256 fee = getFee();
        return _value.mul(fee).div(MAX_FEE);
    }

    /**
    * @dev Sets the fee percentage amount for the mediator operations.
    * @param _fee the fee percentage
    */
    function setFee(uint256 _fee) external validFee(_fee) {
        uintStorage[FEE_STORAGE_KEY] = _fee;
        emit FeeUpdated(_fee);
    }

    /**
    * @dev Tells the fee percentage amount for the mediator operations.
    * @return the fee percentage amount
    */
    function getFee() public view returns (uint256) {
        return uintStorage[FEE_STORAGE_KEY];
    }

    /**
    * @dev Adds a new account to the list of accounts to receive rewards for the operations.
    * @param _account new reward account
    */
    function addRewardAccount(address _account) external {
        require(_account != address(0) && _account != F_ADDR);
        require(!isRewardAccount(_account));

        address firstAccount = getNextRewardAccount(F_ADDR);
        // if list wasn't initialized
        if (firstAccount == address(0)) {
            firstAccount = F_ADDR;
        }
        setNextRewardAccount(_account, firstAccount);
        setNextRewardAccount(F_ADDR, _account);
        setRewardAccountsCount(rewardAccountsCount().add(1));
    }

    /**
    * @dev Removes an account from the list of accounts to receive rewards for the operations.
    * @param _account to be removed
    */
    function removeRewardAccount(address _account) external {
        require(isRewardAccount(_account));
        address accountNext = getNextRewardAccount(_account);
        address index = F_ADDR;
        address next = getNextRewardAccount(index);
        require(next != address(0));

        while (next != _account) {
            index = next;
            next = getNextRewardAccount(index);

            require(next != F_ADDR && next != address(0));
        }

        setNextRewardAccount(index, accountNext);
        delete addressStorage[keccak256(abi.encodePacked("rewardAccountList", _account))];
        setRewardAccountsCount(rewardAccountsCount().sub(1));
    }

    /**
    * @dev Tells the amount of accounts in the list of reward accounts.
    * @return amount of accounts.
    */
    function rewardAccountsCount() internal view returns (uint256) {
        return uintStorage[REWARD_ACCOUNTS_COUNT];
    }

    /**
    * @dev Stores the amount of accounts in the list of reward accounts.
    * @param _count amount of accounts.
    */
    function setRewardAccountsCount(uint256 _count) internal {
        require(_count <= MAX_REWARD_ACCOUNTS);
        uintStorage[REWARD_ACCOUNTS_COUNT] = _count;
    }

    /**
    * @dev Tells if the account is part of the list of reward accounts.
    * @param _account to check if is part of the list.
    * @return true if the account is in the list
    */
    function isRewardAccount(address _account) internal view returns (bool) {
        return _account != F_ADDR && getNextRewardAccount(_account) != address(0);
    }

    /**
    * @dev Tells the next account in the list of reward accounts.
    * @param _address previous account in the list.
    * @return _account next account in the list.
    */
    function getNextRewardAccount(address _address) internal view returns (address) {
        return addressStorage[keccak256(abi.encodePacked("rewardAccountList", _address))];
    }

    /**
    * @dev Stores the next account in the list of reward accounts.
    * @param _prevAccount previous account in the list.
    * @param _account next account in the list.
    */
    function setNextRewardAccount(address _prevAccount, address _account) internal {
        addressStorage[keccak256(abi.encodePacked("rewardAccountList", _prevAccount))] = _account;
    }

    /**
    * @dev Distributes the provided amount of fees proportionally to the list of reward accounts.
    * In case the fees cannot be equally distributed, the remaining difference will be distributed to an account
    * in a semi-random way.
    * @param _fee total amount to be distributed to the list of reward accounts.
    */
    function distributeFee(uint256 _fee) external {
        uint256 numOfAccounts = rewardAccountsCount();
        if (numOfAccounts > 0) {
            uint256 feePerValidator = _fee.div(numOfAccounts);
            uint256 randomValidatorIndex;
            uint256 diff = _fee.sub(feePerValidator.mul(numOfAccounts));
            if (diff > 0) {
                randomValidatorIndex = random(numOfAccounts);
            }

            address nextRewardAccount = getNextRewardAccount(F_ADDR);
            require((nextRewardAccount != F_ADDR) && (nextRewardAccount != address(0)));

            uint256 i = 0;
            while (nextRewardAccount != F_ADDR) {
                uint256 feeToDistribute = feePerValidator;
                if (diff > 0 && randomValidatorIndex == i) {
                    feeToDistribute = feeToDistribute.add(diff);
                }

                onFeeDistribution(nextRewardAccount, feeToDistribute);

                nextRewardAccount = getNextRewardAccount(nextRewardAccount);
                require(nextRewardAccount != address(0));
                i = i + 1;
            }
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
