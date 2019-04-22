pragma solidity 0.4.24;

import "./BaseFeeManager.sol";
import "../IRewardableValidators.sol";

contract ValidatorsFeeManager is BaseFeeManager {

    bytes32 public constant REWARD_FOR_TRANSFERRING_FROM_HOME = keccak256(abi.encodePacked("reward-transferring-from-home"));

    bytes32 public constant REWARD_FOR_TRANSFERRING_FROM_FOREIGN = keccak256(abi.encodePacked("reward-transferring-from-foreign"));

    function distributeFeeFromAffirmation(uint256 _fee) external {
        distributeFeeProportionally(_fee, REWARD_FOR_TRANSFERRING_FROM_FOREIGN);
    }

    function distributeFeeFromSignatures(uint256 _fee) external {
        distributeFeeProportionally(_fee, REWARD_FOR_TRANSFERRING_FROM_HOME);
    }

    function rewardableValidatorContract() internal view returns(IRewardableValidators) {
        return IRewardableValidators(addressStorage[keccak256(abi.encodePacked("validatorContract"))]);
    }

    function distributeFeeProportionally(uint256 _fee, bytes32 _direction) internal {
        IRewardableValidators validators = rewardableValidatorContract();
        address[] memory validatorList = validators.validatorList();
        uint256 feePerValidator = _fee.div(validatorList.length);

        uint256 randomValidatorIndex;
        uint256 diff = _fee.sub(feePerValidator.mul(validatorList.length));
        if (diff > 0) {
            randomValidatorIndex = random(validatorList.length);
        }

        for (uint256 i = 0; i < validatorList.length; i++) {
            uint256 feeToDistribute = feePerValidator;
            if (diff > 0 && randomValidatorIndex == i) {
                feeToDistribute = feeToDistribute.add(diff);
            }
            address rewardAddress = validators.getValidatorRewardAddress(validatorList[i]);
            onFeeDistribution(rewardAddress, feeToDistribute, _direction);
        }
    }

    function onFeeDistribution(address _rewardAddress, uint256 _fee, bytes32 _direction) internal {
        if (_direction == REWARD_FOR_TRANSFERRING_FROM_FOREIGN) {
            onAffirmationFeeDistribution(_rewardAddress, _fee);
        } else {
            onSignatureFeeDistribution(_rewardAddress, _fee);
        }
    }

    function onAffirmationFeeDistribution(address _rewardAddress, uint256 _fee) internal;

    function onSignatureFeeDistribution(address _rewardAddress, uint256 _fee) internal;
}
