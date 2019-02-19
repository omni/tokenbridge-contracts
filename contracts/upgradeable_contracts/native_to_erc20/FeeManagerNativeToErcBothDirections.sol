pragma solidity 0.4.24;

import "../BaseFeeManager.sol";
import "../../IBurnableMintableERC677Token.sol";
import "../Sacrifice.sol";


contract FeeManagerNativeToErcBothDirections is BaseFeeManager {

    function onRequestForSignature(uint256 _value) external view returns(uint256) {
        uint256 fee = calculateFee(_value, false, HOME_FEE);
        return _value.sub(fee);
    }

    function onSignaturesCollected(uint256 _value) external {
        uint256 fee = calculateFee(_value, true, HOME_FEE);
        distributeFeeFromSignatures(fee);
    }

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
