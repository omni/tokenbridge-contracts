pragma solidity 0.4.24;

import "../upgradeability/EternalStorage.sol";
import "../libraries/SafeMath.sol";
import "../IRewardableValidators.sol";


contract BaseFeeManager is EternalStorage {
    using SafeMath for uint256;

    event FeeUpdated(uint256 fee);

    function calculateFee(uint256 _value, bool _recover) external view returns(uint256) {
        uint256 fee = getFee();
        uint256 eth = 1 ether;
        if (!_recover) {
            return _value.mul(fee).div(eth);
        }
        return _value.mul(fee).div(eth.sub(fee));
    }

    function setFee(uint256 _fee) external {
        uintStorage[keccak256(abi.encodePacked("fee"))] = _fee;
        emit FeeUpdated(_fee);
    }

    function getFee() public view returns(uint256) {
        return uintStorage[keccak256(abi.encodePacked("fee"))];
    }

    function distributeFeeFromAffirmation(uint256 _fee) external {
        distributeFeeProportionally(_fee, true);
    }

    function distributeFeeFromSignatures(uint256 _fee) external {
        distributeFeeProportionally(_fee, false);
    }

    function distributeFeeProportionally(uint256 _fee, bool _isAffirmation) internal {
        IRewardableValidators validators = rewardableValidatorContract();
        address [] memory validatorList = validators.validatorList();
        uint256 feePerValidator = _fee.div(validatorList.length);

        for (uint256 i = 0; i < validatorList.length; i++) {
            address rewardAddress = validators.getValidatorRewardAddress(validatorList[i]);
            onFeeDistribution(rewardAddress, feePerValidator, _isAffirmation);
        }
    }

    function onFeeDistribution(address _rewardAddress, uint256 _fee, bool _isAffirmation) internal {
        if (_isAffirmation) {
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
