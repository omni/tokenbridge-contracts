pragma solidity 0.4.24;

import "../BaseFeeManager.sol";
import "../../IBurnableMintableERC677Token.sol";
import "../Sacrifice.sol";


contract FeeManagerNativeToErcBothDirections is BaseFeeManager {

    function getFeeManagerMode() public pure returns(bytes4) {
        return bytes4(keccak256(abi.encodePacked("manages-both-directions")));
    }

    function onAffirmationFeeDistribution(address _rewardAddress, uint256 _fee) internal {
        _sendReward(_rewardAddress, _fee);
    }

    function onSignatureFeeDistribution(address _rewardAddress, uint256 _fee) internal {
        _sendReward(_rewardAddress, _fee);
    }

    function _sendReward(address _rewardAddress, uint256 _fee) internal {
        if (!_rewardAddress.send(_fee)) {
            (new Sacrifice).value(_fee)(_rewardAddress);
        }
    }
}
