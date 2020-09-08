pragma solidity 0.4.24;

import "../interfaces/IBlockReward.sol";
import "../upgradeability/EternalStorage.sol";
import "openzeppelin-solidity/contracts/AddressUtils.sol";

contract BlockRewardBridge is EternalStorage {
    bytes32
        internal constant BLOCK_REWARD_CONTRACT = 0x20ae0b8a761b32f3124efb075f427dd6ca669e88ae7747fec9fd1ad688699f32; // keccak256(abi.encodePacked("blockRewardContract"))
    bytes4 internal constant BLOCK_REWARD_CONTRACT_ID = 0x2ee57f8d; // blockRewardContractId()
    bytes4 internal constant BRIDGES_ALLOWED_LENGTH = 0x10f2ee7c; // bridgesAllowedLength()

    function _blockRewardContract() internal view returns (IBlockReward) {
        return IBlockReward(addressStorage[BLOCK_REWARD_CONTRACT]);
    }

    function _setBlockRewardContract(address _blockReward) internal {
        require(AddressUtils.isContract(_blockReward));

        // Before store the contract we need to make sure that it is the block reward contract in actual fact,
        // call a specific method from the contract that should return a specific value
        bool isBlockRewardContract = false;
        if (_blockReward.call(BLOCK_REWARD_CONTRACT_ID)) {
            isBlockRewardContract =
                IBlockReward(_blockReward).blockRewardContractId() == bytes4(keccak256("blockReward"));
        } else if (_blockReward.call(BRIDGES_ALLOWED_LENGTH)) {
            isBlockRewardContract = IBlockReward(_blockReward).bridgesAllowedLength() != 0;
        }
        require(isBlockRewardContract);
        addressStorage[BLOCK_REWARD_CONTRACT] = _blockReward;
    }
}
