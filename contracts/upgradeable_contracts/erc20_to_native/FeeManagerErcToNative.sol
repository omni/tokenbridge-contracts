pragma solidity 0.4.24;

import "../../interfaces/IBlockReward.sol";
import "../Sacrifice.sol";
import "../ValidatorsFeeManager.sol";
import "../BlockRewardBridge.sol";

contract FeeManagerErcToNative is ValidatorsFeeManager, BlockRewardBridge {
    function getFeeManagerMode() external pure returns (bytes4) {
        return bytes4(keccak256(abi.encodePacked("manages-both-directions")));
    }

    function onAffirmationFeeDistribution(address _rewardAddress, uint256 _fee) internal {
        IBlockReward blockReward = _blockRewardContract();
        blockReward.addExtraReceiver(_fee, _rewardAddress);
    }

    function onSignatureFeeDistribution(address _rewardAddress, uint256 _fee) internal {
        if (!_rewardAddress.send(_fee)) {
            (new Sacrifice).value(_fee)(_rewardAddress);
        }
    }

    function getAmountToBurn(uint256 _value) public view returns (uint256) {
        uint256 fee = calculateFee(_value, false, HOME_FEE);
        return _value.sub(fee);
    }
}
