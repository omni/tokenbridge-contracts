pragma solidity 0.4.24;

import "../BlockRewardFeeManager.sol";

contract FeeManagerErcToErcPOSDAO is BlockRewardFeeManager {
    function getFeeManagerMode() external pure returns (bytes4) {
        return bytes4(keccak256(abi.encodePacked("manages-both-directions")));
    }

    function blockRewardContract() external view returns (address) {
        return _blockRewardContract();
    }

    function setBlockRewardContract(address _blockReward) external {
        require(isContract(_blockReward));

        // Before store the contract we need to make sure that it is the block reward contract in actual fact,
        // call a specific method from the contract that should return a specific value
        bool isBlockRewardContract = false;
        if (_blockReward.call(abi.encodeWithSignature("blockRewardContractId()"))) {
            isBlockRewardContract =
                IBlockReward(_blockReward).blockRewardContractId() == bytes4(keccak256("blockReward"));
        } else if (_blockReward.call(abi.encodeWithSignature("bridgesAllowedLength()"))) {
            isBlockRewardContract = IBlockReward(_blockReward).bridgesAllowedLength() != 0;
        }
        require(isBlockRewardContract);
        addressStorage[keccak256(abi.encodePacked("blockRewardContract"))] = _blockReward;
    }

    function distributeFeeFromBlockReward(uint256 _fee) internal {
        IBlockReward blockReward = _blockRewardContract();
        blockReward.addBridgeTokenFeeReceivers(_fee);
    }

    function isContract(address _addr) internal view returns (bool) {
        uint256 length;
        assembly {
            length := extcodesize(_addr)
        }
        return length > 0;
    }
}
