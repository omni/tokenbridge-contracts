pragma solidity 0.4.24;

import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "../MediatorOwnableModule.sol";

/**
 * @title MultiTokenFeeManager
 * @dev Implements the logic to distribute fees from the multi erc20 to erc677 mediator contract operations.
 * The fees are distributed in the form of ERC20/ERC677 tokens to the list of reward addresses.
 */
contract MultiTokenFeeManager is MediatorOwnableModule {
    using SafeMath for uint256;

    // This is not a real fee value but a relative value used to calculate the fee percentage.
    // 1 ether = 100% of the value.
    uint256 internal constant MAX_FEE = 1 ether;
    uint256 internal constant MAX_REWARD_ACCOUNTS = 50;

    bytes32 public constant HOME_TO_FOREIGN_FEE = 0x741ede137d0537e88e0ea0ff25b1f22d837903dbbee8980b4a06e8523247ee26; // keccak256(abi.encodePacked("homeToForeignFee"))
    bytes32 public constant FOREIGN_TO_HOME_FEE = 0x03be2b2875cb41e0e77355e802a16769bb8dfcf825061cde185c73bf94f12625; // keccak256(abi.encodePacked("foreignToHomeFee"))

    // mapping feeType => token address => fee percentage
    mapping(bytes32 => mapping(address => uint256)) internal fees;
    address[] internal rewardAddresses;
    mapping(address => bool) internal isRegistered;

    event FeeUpdated(bytes32 feeType, address indexed token, uint256 fee);

    /**
     * @dev Stores the initial parameters of the fee manager.
     * @param _mediator address of the mediator contract used together with this fee manager.
     * @param _owner address of the contract owner.
     * @param _rewardAddresses list of unique initial reward addresses, between whom fees will be distributed
     * @param _fees array with initial fees for both bridge directions.
     *   [ 0 = homeToForeignFee, 1 = foreignToHomeFee ]
     */
    constructor(address _mediator, address _owner, address[] _rewardAddresses, uint256[2] _fees)
        public
        MediatorOwnableModule(_mediator, _owner)
    {
        require(_rewardAddresses.length <= MAX_REWARD_ACCOUNTS);
        _setFee(HOME_TO_FOREIGN_FEE, address(0), _fees[0]);
        _setFee(FOREIGN_TO_HOME_FEE, address(0), _fees[1]);

        for (uint256 i = 0; i < _rewardAddresses.length; i++) {
            require(_isValidAddress(_rewardAddresses[i]));
            for (uint256 j = 0; j < i; j++) {
                require(_rewardAddresses[j] != _rewardAddresses[i]);
            }
        }
        rewardAddresses = _rewardAddresses;
    }

    /**
     * @dev Throws if given fee amount is invalid.
     */
    modifier validFee(uint256 _fee) {
        require(_fee < MAX_FEE);
        /* solcov ignore next */
        _;
    }

    /**
     * @dev Throws if given fee type is unknown.
     */
    modifier validFeeType(bytes32 _feeType) {
        require(_feeType == HOME_TO_FOREIGN_FEE || _feeType == FOREIGN_TO_HOME_FEE);
        /* solcov ignore next */
        _;
    }

    /**
     * @dev Updates the value for the particular fee type.
     * Only the owner can call this method.
     * @param _feeType type of the updated fee, can be one of [HOME_TO_FOREIGN_FEE, FOREIGN_TO_HOME_FEE].
     * @param _token address of the token contract for which fee should apply, 0x00..00 describes the initial fee for newly created tokens.
     * @param _fee new fee value, in percentage (1 ether == 10**18 == 100%).
     */
    function setFee(bytes32 _feeType, address _token, uint256 _fee) external validFeeType(_feeType) onlyOwner {
        require(_token == address(0) || isRegistered[_token]);
        _setFee(_feeType, _token, _fee);
    }

    /**
     * @dev Retrieves the value for the particular fee type.
     * @param _feeType type of the updated fee, can be one of [HOME_TO_FOREIGN_FEE, FOREIGN_TO_HOME_FEE].
     * @param _token address of the token contract for which fee should apply, 0x00..00 describes the initial fee for newly created tokens.
     * @return fee value associated with the requested fee type.
     */
    function getFee(bytes32 _feeType, address _token) public view validFeeType(_feeType) returns (uint256) {
        return fees[_feeType][_token];
    }

    /**
     * @dev Calculates the amount of fee to pay for the value of the particular fee type.
     * @param _feeType type of the updated fee, can be one of [HOME_TO_FOREIGN_FEE, FOREIGN_TO_HOME_FEE].
     * @param _token address of the token contract for which fee should apply, 0x00..00 describes the initial fee for newly created tokens.
     * @param _value bridged value, for which fee should be evaluated.
     * @return amount of fee to be subtracted from the transferred value.
     */
    function calculateFee(bytes32 _feeType, address _token, uint256 _value) public view returns (uint256) {
        uint256 _fee = getFee(_feeType, _token);
        return _value.mul(_fee).div(MAX_FEE);
    }

    /**
     * @dev Adds a new address to the list of accounts to receive rewards for the operations.
     * Only the owner can call this method.
     * @param _addr new reward address.
     */
    function addRewardAddress(address _addr) external onlyOwner {
        require(_isValidAddress(_addr));
        require(!isRewardAddress(_addr));
        require(rewardAddresses.length < MAX_REWARD_ACCOUNTS);
        rewardAddresses.push(_addr);
    }

    /**
     * @dev Removes an address from the list of accounts to receive rewards for the operations.
     * Only the owner can call this method.
     * finds the element, swaps it with the last element, and then deletes it;
     * @param _addr to be removed.
     * return boolean whether the element was found and deleted
     */
    function removeRewardAddress(address _addr) external onlyOwner {
        uint256 numOfAccounts = rewardAddresses.length;
        for (uint256 i = 0; i < numOfAccounts; i++) {
            if (rewardAddresses[i] == _addr) {
                rewardAddresses[i] = rewardAddresses[numOfAccounts - 1];
                delete rewardAddresses[numOfAccounts - 1];
                rewardAddresses.length--;
                return;
            }
        }
        // If account is not found and removed, the transactions is reverted
        revert();
    }

    /**
     * @dev Tells the number of registered reward receivers.
     * @return amount of addresses.
     */
    function rewardAddressCount() external view returns (uint256) {
        return rewardAddresses.length;
    }

    /**
     * @dev Tells the list of registered reward receivers.
     * @return list with all registered reward receivers.
     */
    function rewardAddressList() external view returns (address[]) {
        return rewardAddresses;
    }

    /**
     * @dev Tells if a given address is part of the reward address list.
     * @param _addr address to check if it is part of the list.
     * @return true if the given address is in the list
     */
    function isRewardAddress(address _addr) public view returns (bool) {
        for (uint256 i = 0; i < rewardAddresses.length; i++) {
            if (rewardAddresses[i] == _addr) {
                return true;
            }
        }
        return false;
    }

    /**
     * @dev Initializes fee parameters for a particular token if needed, calculates and returns fee amount.
     * @param _feeType type of the updated fee, can be one of [HOME_TO_FOREIGN_FEE, FOREIGN_TO_HOME_FEE].
     * @param _token address of the token contract for which fee should apply.
     * @param _value bridged value, for which fee should be evaluated.
     * @return total amount of fee subtracted from the transferred value and distributed between the reward receivers.
     */
    function initAndCalculateFee(bytes32 _feeType, address _token, uint256 _value)
        external
        onlyMediator
        returns (uint256)
    {
        // when fee distribution is first called for this token
        // the fee percentages should be copied from the default values
        if (!isRegistered[_token]) {
            _setFee(HOME_TO_FOREIGN_FEE, _token, fees[HOME_TO_FOREIGN_FEE][address(0)]);
            _setFee(FOREIGN_TO_HOME_FEE, _token, fees[FOREIGN_TO_HOME_FEE][address(0)]);
            isRegistered[_token] = true;
        }

        uint256 _fee = calculateFee(_feeType, _token, _value);
        return rewardAddresses.length == 0 ? 0 : _fee;
    }

    /**
     * @dev Distributes the fee proportionally between registered reward addresses.
     * @param _token address of the token contract for which fee should be distributed.
     * @param _fee fee amount to distribute.
     */
    function distributeFee(address _token, uint256 _fee) external onlyMediator {
        uint256 numOfAccounts = rewardAddresses.length;
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
            ERC20(_token).transfer(rewardAddresses[i], feeToDistribute);
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

    /**
     * @dev Internal function for updating the fee value for the given fee type.
     * @param _feeType type of the updated fee, can be one of [HOME_TO_FOREIGN_FEE, FOREIGN_TO_HOME_FEE].
     * @param _token address of the token contract for which fee should apply, 0x00..00 describes the initial fee for newly created tokens.
     * @param _fee new fee value, in percentage (1 ether == 10**18 == 100%).
     */
    function _setFee(bytes32 _feeType, address _token, uint256 _fee) internal validFee(_fee) {
        fees[_feeType][_token] = _fee;
        emit FeeUpdated(_feeType, _token, _fee);
    }

    /**
     * @dev Checks if a given address can be a reward receiver.
     * @param _addr address of the proposed reward receiver.
     * @return true, if address is valid.
     */
    function _isValidAddress(address _addr) internal returns (bool) {
        return _addr != address(0) && _addr != address(mediator);
    }
}
