pragma solidity 0.4.24;

import "../upgradeability/EternalStorage.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "../interfaces/IRewardableValidators.sol";
import "./FeeTypes.sol";

contract BaseFeeManager is EternalStorage, FeeTypes {
    using SafeMath for uint256;

    event HomeFeeUpdated(uint256 previousFee, uint256 newFee);
    event ForeignFeeUpdated(uint256 previousFee, uint256 newFee);

    // This is not a real fee value but a relative value used to calculate the fee percentage
    uint256 internal constant MAX_FEE = 1 ether;

    function calculateFee(uint256 _value, bool _recover, bytes32 _feeType) public view returns (uint256) {
        uint256 fee = _feeType == HOME_FEE ? getHomeFee() : getForeignFee();
        if (!_recover) {
            return _value.mul(fee).div(MAX_FEE);
        }
        return _value.mul(fee).div(MAX_FEE.sub(fee));
    }

    modifier validFee(uint256 _fee) {
        require(_fee < MAX_FEE);
        /* solcov ignore next */
        _;
    }

    function setHomeFee(uint256 _fee) external validFee(_fee) {
        emit HomeFeeUpdated(getHomeFee(), _fee);
        uintStorage[keccak256(abi.encodePacked("homeFee"))] = _fee;
    }

    function getHomeFee() public view returns (uint256) {
        return uintStorage[keccak256(abi.encodePacked("homeFee"))];
    }

    function setForeignFee(uint256 _fee) external validFee(_fee) {
        emit ForeignFeeUpdated(getForeignFee(), _fee);
        uintStorage[keccak256(abi.encodePacked("foreignFee"))] = _fee;
    }

    function getForeignFee() public view returns (uint256) {
        return uintStorage[keccak256(abi.encodePacked("foreignFee"))];
    }

    /* solcov ignore next */
    function distributeFeeFromAffirmation(uint256 _fee) external;

    /* solcov ignore next */
    function distributeFeeFromSignatures(uint256 _fee) external;

    /* solcov ignore next */
    function getFeeManagerMode() external pure returns (bytes4);

    function random(uint256 _count) internal view returns (uint256) {
        return uint256(blockhash(block.number.sub(1))) % _count;
    }
}
