pragma solidity 0.4.24;

import "../BaseFeeManager.sol";
import "../Validatable.sol";
import "../../libraries/SafeMath.sol";
import "../../IBridgeValidators.sol";
import "../../IBlockReward.sol";

contract FeeManagerErcToNative is BaseFeeManager, Validatable {
    using SafeMath for uint256;

    function distributeFeeFromAffirmation(uint256 _fee) external {
        // TODO: decide whether distribute by stake or proportionally
        distributeFeeFromAffirmationProportionally(_fee);
    }

    function distributeFeeFromSignatures(uint256 _fee) external {
        // TODO: decide whether distribute by stake or proportionally
        distributeFeeFromSignatureProportionally(_fee);
    }

    //
    // Distribute Proportionally
    //
    function distributeFeeFromAffirmationProportionally(uint _fee) private {
        uint256 feePerValidator = proportionalFee();
        address nextValidator = validators.getNextValidator(validators.F_ADDR());

        while (nextValidator != validators.F_ADDR()) {
            address rewardAddress = validators.getValidatorRewardAddress(nextValidator);
            require(rewardAddress != address(0));
            blockReward.addExtraReceiver(feePerValidator, rewardAddress);
            nextValidator = validators.getNextValidator(nextValidator);
        }
    }

    function distributeFeeFromSignatureProportionally(uint _fee) private {
        uint256 feePerValidator = proportionalFee();
        address nextValidator = validators.getNextValidator(validators.F_ADDR());

        while (nextValidator != validators.F_ADDR()) {
            address rewardAddress = validators.getValidatorRewardAddress(nextValidator);
            require(rewardAddress != address(0));
            rewardAddress.send(feePerValidator);
            nextValidator = validators.getNextValidator(nextValidator);
        }
    }

    function proportionalFee() private returns(uint256) {
        IBridgeValidators validators = validatorContract();
        IBlockReward blockReward = blockRewardContract();
        uint256 validatorsCount = validators.validatorCount();
        uint256 feePerValidator = _fee.div(validatorsCount);
        return feePerValidator;
    }

    //
    // Distribute By Stake
    //
    function distributeFeeFromSignatureByStake(uint _fee) private {
        // TODO: implement fee distribution from signature by stake
    }

    function distributeFeeFromAffirmationByStake(uint _fee) private {
        // TODO: implement fee distribution from affirmation by stake
    }

    function stakeBasedFee(address _validator) private returns(uint256) {
        // TODO: calculate fee for _validator based on its stake
    }
}
