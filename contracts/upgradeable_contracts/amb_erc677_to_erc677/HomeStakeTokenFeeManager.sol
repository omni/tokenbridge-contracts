pragma solidity 0.4.24;

import "../BlockRewardBridge.sol";
import "../Ownable.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";

contract HomeStakeTokenFeeManager is BlockRewardBridge, Ownable {
    using SafeMath for uint256;

    event FeeUpdated(uint256 fee);

    uint256 internal constant MAX_FEE = 1 ether;
    bytes32 internal constant FEE = 0x241773621b963145d8e249ca69b0240df7de56fca52fb3ec9e2ddd08a968570e; // keccak256(abi.encodePacked("stakeTokenFee"));

    /**
     * @dev Retrieves currently used block reward contract
     * @return configured block reward contract address
     */
    function blockRewardContract() external view returns (IBlockReward) {
        return _blockRewardContract();
    }

    /**
     * @dev Updates address of currently used block reward contract
     * @param _blockReward address of a new contract
     */
    function setBlockRewardContract(address _blockReward) external onlyOwner {
        _setBlockRewardContract(_blockReward);
    }

    /**
     * @dev Retrieves current fee value
     * @return current value of fee, 1e18 is 100%
     */
    function getFee() public view returns (uint256) {
        return uintStorage[FEE];
    }

    /**
     * @dev Calculates the fee amount to be subtracted from the value.
     * @param _value the base value from which fees are calculated
     */
    function calculateFee(uint256 _value) public view returns (uint256) {
        return _value.mul(getFee()).div(MAX_FEE);
    }

    /**
     * @dev Sets the fee percentage amount for the mediator operations.
     * Only the owner can call this method.
     * @param _fee the fee percentage
     */
    function setFee(uint256 _fee) external onlyOwner {
        _setFee(_fee);
    }

    /**
     * @dev Internal setter for fee
     * @param _fee the fee percentage
     */
    function _setFee(uint256 _fee) internal {
        require(_fee < MAX_FEE);
        uintStorage[FEE] = _fee;
        emit FeeUpdated(_fee);
    }

    /**
     * @dev Returns the state of the fee manager configuration: whether
     * it is ready to collect and distribute fee or not.
     */
    function isFeeCollectingActivated() public view returns (bool) {
        return ((address(_blockRewardContract()) != address(0)) && (getFee() > 0));
    }

    /**
     * @dev Distributes fee as per the logic of the fee manager.
     * In this particular case, the amount of fee is passed the block 
     * reward contract which will mint new tokens and distribute them
     * among the stakers.
     * IMPORTANT: make sure that the code checks that the block reward
     * contract is initialized before calling this method.
     * @param _fee amount of tokens to be distributed
     */
    function _distributeFee(uint256 _fee) internal {
        _blockRewardContract().addBridgeTokenRewardReceivers(_fee);
    }
}
