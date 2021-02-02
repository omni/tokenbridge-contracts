pragma solidity 0.4.24;

import "./BasicMultiTokenBridge.sol";
import "../BaseRewardAddressList.sol";
import "../Ownable.sol";
import "../../interfaces/ERC677.sol";
import "../../interfaces/IBurnableMintableERC677Token.sol";

/**
* @title HomeFeeManagerMultiAMBErc20ToErc677
* @dev Implements the logic to distribute fees from the multi erc20 to erc677 mediator contract operations.
* The fees are distributed in the form of native tokens to the list of reward accounts.
*/
contract HomeFeeManagerMultiAMBErc20ToErc677 is BaseRewardAddressList, Ownable, BasicMultiTokenBridge {
    using SafeMath for uint256;

    event FeeUpdated(bytes32 feeType, address indexed token, uint256 fee);
    event FeeDistributed(uint256 fee, address indexed token, bytes32 indexed messageId);

    // This is not a real fee value but a relative value used to calculate the fee percentage
    uint256 internal constant MAX_FEE = 1 ether;
    bytes32 public constant HOME_TO_FOREIGN_FEE = 0x741ede137d0537e88e0ea0ff25b1f22d837903dbbee8980b4a06e8523247ee26; // keccak256(abi.encodePacked("homeToForeignFee"))
    bytes32 public constant FOREIGN_TO_HOME_FEE = 0x03be2b2875cb41e0e77355e802a16769bb8dfcf825061cde185c73bf94f12625; // keccak256(abi.encodePacked("foreignToHomeFee"))

    /**
    * @dev Throws if given fee percentage is >= 100%.
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
    * @dev Adds a new reward address to the list, which will receive fees collected from the bridge operations.
    * Only the owner can call this method.
    * @param _addr new reward account.
    */
    function addRewardAddress(address _addr) external onlyOwner {
        _addRewardAddress(_addr);
    }

    /**
    * @dev Removes a reward address from the rewards list.
    * Only the owner can call this method.
    * @param _addr old reward account, that should be removed.
    */
    function removeRewardAddress(address _addr) external onlyOwner {
        _removeRewardAddress(_addr);
    }

    /**
    * @dev Updates the value for the particular fee type.
    * Only the owner can call this method.
    * @param _feeType type of the updated fee, can be one of [HOME_TO_FOREIGN_FEE, FOREIGN_TO_HOME_FEE].
    * @param _token address of the token contract for which fee should apply, 0x00..00 describes the initial fee for newly created tokens.
    * @param _fee new fee value, in percentage (1 ether == 10**18 == 100%).
    */
    function setFee(bytes32 _feeType, address _token, uint256 _fee) external onlyOwner {
        _setFee(_feeType, _token, _fee);
    }

    /**
    * @dev Retrieves the value for the particular fee type.
    * @param _feeType type of the updated fee, can be one of [HOME_TO_FOREIGN_FEE, FOREIGN_TO_HOME_FEE].
    * @param _token address of the token contract for which fee should apply, 0x00..00 describes the initial fee for newly created tokens.
    * @return fee value associated with the requested fee type.
    */
    function getFee(bytes32 _feeType, address _token) public view validFeeType(_feeType) returns (uint256) {
        return uintStorage[keccak256(abi.encodePacked(_feeType, _token))];
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
    * @dev Internal function for updating the fee value for the given fee type.
    * @param _feeType type of the updated fee, can be one of [HOME_TO_FOREIGN_FEE, FOREIGN_TO_HOME_FEE].
    * @param _token address of the token contract for which fee should apply, 0x00..00 describes the initial fee for newly created tokens.
    * @param _fee new fee value, in percentage (1 ether == 10**18 == 100%).
    */
    function _setFee(bytes32 _feeType, address _token, uint256 _fee) internal validFeeType(_feeType) validFee(_fee) {
        require(isTokenRegistered(_token));
        uintStorage[keccak256(abi.encodePacked(_feeType, _token))] = _fee;
        emit FeeUpdated(_feeType, _token, _fee);
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
    * @dev Calculates and distributes the amount of fee proportionally between registered reward addresses.
    * @param _feeType type of the updated fee, can be one of [HOME_TO_FOREIGN_FEE, FOREIGN_TO_HOME_FEE].
    * @param _token address of the token contract for which fee should apply, 0x00..00 describes the initial fee for newly created tokens.
    * @param _value bridged value, for which fee should be evaluated.
    * @return total amount of fee subtracted from the transferred value and distributed between the reward accounts.
    */
    function _distributeFee(bytes32 _feeType, address _token, uint256 _value) internal returns (uint256) {
        uint256 numOfAccounts = rewardAddressCount();
        uint256 _fee = calculateFee(_feeType, _token, _value);
        if (numOfAccounts == 0 || _fee == 0) {
            return 0;
        }
        uint256 feePerAccount = _fee.div(numOfAccounts);
        uint256 randomAccountIndex;
        uint256 diff = _fee.sub(feePerAccount.mul(numOfAccounts));
        if (diff > 0) {
            randomAccountIndex = random(numOfAccounts);
        }

        address nextAddr = getNextRewardAddress(F_ADDR);
        require(nextAddr != F_ADDR && nextAddr != address(0));

        uint256 i = 0;
        while (nextAddr != F_ADDR) {
            uint256 feeToDistribute = feePerAccount;
            if (diff > 0 && randomAccountIndex == i) {
                feeToDistribute = feeToDistribute.add(diff);
            }

            if (_feeType == HOME_TO_FOREIGN_FEE) {
                ERC677(_token).transfer(nextAddr, feeToDistribute);
            } else {
                _getMinterFor(_token).mint(nextAddr, feeToDistribute);
            }

            nextAddr = getNextRewardAddress(nextAddr);
            require(nextAddr != address(0));
            i = i + 1;
        }
        return _fee;
    }

    function _getMinterFor(address _token) internal view returns (IBurnableMintableERC677Token);
}
