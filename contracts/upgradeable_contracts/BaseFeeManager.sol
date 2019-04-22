pragma solidity 0.4.24;

import "../upgradeability/EternalStorage.sol";
import "../libraries/SafeMath.sol";
import "../IRewardableValidators.sol";
import "./FeeTypes.sol";


contract BaseFeeManager is EternalStorage, FeeTypes {
    using SafeMath for uint256;

    bytes32 public constant REWARD_FOR_TRANSFERRING_FROM_HOME = keccak256(abi.encodePacked("reward-transferring-from-home"));

    bytes32 public constant REWARD_FOR_TRANSFERRING_FROM_FOREIGN = keccak256(abi.encodePacked("reward-transferring-from-foreign"));

    event HomeFeeUpdated(uint256 fee);
    event ForeignFeeUpdated(uint256 fee);

    function calculateFee(uint256 _value, bool _recover, bytes32 _feeType) public view returns(uint256) {
        uint256 fee = _feeType == HOME_FEE ? getHomeFee() : getForeignFee();
        uint256 eth = 1 ether;
        if (!_recover) {
            return _value.mul(fee).div(eth);
        }
        return _value.mul(fee).div(eth.sub(fee));
    }

    function setHomeFee(uint256 _fee) external {
        uintStorage[keccak256(abi.encodePacked("homeFee"))] = _fee;
        emit HomeFeeUpdated(_fee);
    }

    function getHomeFee() public view returns(uint256) {
        return uintStorage[keccak256(abi.encodePacked("homeFee"))];
    }

    function setForeignFee(uint256 _fee) external {
        uintStorage[keccak256(abi.encodePacked("foreignFee"))] = _fee;
        emit ForeignFeeUpdated(_fee);
    }

    function getForeignFee() public view returns(uint256) {
        return uintStorage[keccak256(abi.encodePacked("foreignFee"))];
    }

    function distributeFeeFromAffirmation(uint256 _fee) external {
        distributeFeeProportionally(_fee, REWARD_FOR_TRANSFERRING_FROM_FOREIGN);
    }

    function distributeFeeFromSignatures(uint256 _fee) external {
        distributeFeeProportionally(_fee, REWARD_FOR_TRANSFERRING_FROM_HOME);
    }

    function getFeeManagerMode() public pure returns(bytes4);

    function random(uint256 _count) public view returns(uint256) {
        return uint256(blockhash(block.number.sub(1))) % _count;
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

    function rewardableValidatorContract() public view returns(IRewardableValidators) {
        return IRewardableValidators(addressStorage[keccak256(abi.encodePacked("validatorContract"))]);
    }
}
