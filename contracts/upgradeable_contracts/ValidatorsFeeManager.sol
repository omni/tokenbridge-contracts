pragma solidity 0.4.24;

import "./BaseFeeManager.sol";
import "../interfaces/IRewardableValidators.sol";
import "./ValidatorStorage.sol";

contract ValidatorsFeeManager is BaseFeeManager, ValidatorStorage {
    bytes32 public constant REWARD_FOR_TRANSFERRING_FROM_HOME = 0x2a11db67c480122765825a7e4bc5428e8b7b9eca0d4e62b91aac194f99edd0d7; // keccak256(abi.encodePacked("reward-transferring-from-home"))
    bytes32 public constant REWARD_FOR_TRANSFERRING_FROM_FOREIGN = 0xb14796d751eb4f2570065a479f9e526eabeb2077c564c8a1c5ea559883ea2fab; // keccak256(abi.encodePacked("reward-transferring-from-foreign"))

    function distributeFeeFromAffirmation(uint256 _fee) external {
        distributeFeeProportionally(_fee, REWARD_FOR_TRANSFERRING_FROM_FOREIGN);
    }

    function distributeFeeFromSignatures(uint256 _fee) external {
        distributeFeeProportionally(_fee, REWARD_FOR_TRANSFERRING_FROM_HOME);
    }

    function rewardableValidatorContract() internal view returns (IRewardableValidators) {
        return IRewardableValidators(addressStorage[VALIDATOR_CONTRACT]);
    }

    function distributeFeeProportionally(uint256 _fee, bytes32 _direction) internal {
        IRewardableValidators validators = rewardableValidatorContract();
        // solhint-disable-next-line var-name-mixedcase
        address F_ADDR = 0xFFfFfFffFFfffFFfFFfFFFFFffFFFffffFfFFFfF;
        uint256 numOfValidators = validators.validatorCount();

        uint256 feePerValidator = _fee.div(numOfValidators);

        uint256 randomValidatorIndex;
        uint256 diff = _fee.sub(feePerValidator.mul(numOfValidators));
        if (diff > 0) {
            randomValidatorIndex = random(numOfValidators);
        }

        address nextValidator = validators.getNextValidator(F_ADDR);
        require((nextValidator != F_ADDR) && (nextValidator != address(0)));

        uint256 i = 0;
        while (nextValidator != F_ADDR) {
            uint256 feeToDistribute = feePerValidator;
            if (diff > 0 && randomValidatorIndex == i) {
                feeToDistribute = feeToDistribute.add(diff);
            }

            address rewardAddress = validators.getValidatorRewardAddress(nextValidator);
            onFeeDistribution(rewardAddress, feeToDistribute, _direction);

            nextValidator = validators.getNextValidator(nextValidator);
            require(nextValidator != address(0));
            i = i + 1;
        }
    }

    function onFeeDistribution(address _rewardAddress, uint256 _fee, bytes32 _direction) internal {
        if (_direction == REWARD_FOR_TRANSFERRING_FROM_FOREIGN) {
            onAffirmationFeeDistribution(_rewardAddress, _fee);
        } else {
            onSignatureFeeDistribution(_rewardAddress, _fee);
        }
    }

    /* solcov ignore next */
    function onAffirmationFeeDistribution(address _rewardAddress, uint256 _fee) internal;

    /* solcov ignore next */
    function onSignatureFeeDistribution(address _rewardAddress, uint256 _fee) internal;
}
