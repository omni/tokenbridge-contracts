pragma solidity 0.4.24;

import "../amb_erc677_to_erc677/HomeAMBErc677ToErc677.sol";
import "../BlockRewardBridge.sol";
import "../../interfaces/IBurnableMintableERC677Token.sol";

contract HomeStakeTokenMediator is HomeAMBErc677ToErc677, BlockRewardBridge {
    event FeeUpdated(uint256 fee);

    uint256 internal constant MAX_FEE = 1 ether;
    bytes32 internal constant FEE = 0x241773621b963145d8e249ca69b0240df7de56fca52fb3ec9e2ddd08a968570e; // keccak256(abi.encodePacked("stakeTokenFee"));
    bytes4 internal constant ADD_BRIDGE_TOKEN_REWARD_RECEIVERS = 0x62178478; // addBridgeTokenRewardReceivers(uint256)

    /**
     * @dev Retrives current used block reward contract
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
     * @dev Sets the fee percentage amount for the mediator operations. Only the owner can call this method.
     * @param _fee the fee percentage
     */
    function setFee(uint256 _fee) external onlyOwner {
        require(_fee < MAX_FEE);
        uintStorage[FEE] = _fee;
        emit FeeUpdated(_fee);
    }

    /**
     * @dev Executes action on incoming bridged tokens
     */
    function bridgeSpecificActionsOnTokenTransfer(ERC677 _token, address _from, uint256 _value, bytes _data) internal {
        if (!lock()) {
            // burn all incoming tokens
            IBurnableMintableERC677Token(_token).burn(_value);

            if (address(_blockRewardContract()) == address(0)) {
                // in case if block reward contract is not configured, the fee is not collected
                passMessage(chooseReceiver(_from, _data), _value);
            } else {
                // when block contract is defined, the calculated fee is substructed from the original value
                uint256 fee = calculateFee(_value);
                passMessage(chooseReceiver(_from, _data), _value.sub(fee));
                if (fee > 0) {
                    // the fee itself is distributed later in the block reward contract
                    _blockRewardContract().call(abi.encodeWithSelector(ADD_BRIDGE_TOKEN_REWARD_RECEIVERS, fee));
                }
            }
        }
    }
}
