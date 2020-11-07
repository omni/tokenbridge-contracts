pragma solidity 0.4.24;

import "../upgradeability/EternalStorage.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "../interfaces/IRewardableValidators.sol";
import "./FeeTypes.sol";

contract BaseFeeManager is EternalStorage, FeeTypes {
    using SafeMath for uint256;

    event HomeFeeUpdated(uint256 fee);
    event ForeignFeeUpdated(uint256 fee);

    // This is not a real fee value but a relative value used to calculate the fee percentage
    uint256 internal constant MAX_FEE = 1 ether;
    bytes32 internal constant HOME_FEE_STORAGE_KEY = 0xc3781f3cec62d28f56efe98358f59c2105504b194242dbcb2cc0806850c306e7; // keccak256(abi.encodePacked("homeFee"))
    bytes32 internal constant FOREIGN_FEE_STORAGE_KEY = 0x68c305f6c823f4d2fa4140f9cf28d32a1faccf9b8081ff1c2de11cf32c733efc; // keccak256(abi.encodePacked("foreignFee"))

    /**
     * @dev Calculated the amount of fee for the particular bridge operation.
     * @param _value bridged amount of tokens/coins for which fee amount is calculated.
     * @param _recover true, if the fee was already subtracted from the given _value and needs to be restored.
     * @param _feeType type of the fee, should be either HOME_FEE of FOREIGN_FEE.
     * @return calculated fee amount.
     */
    function calculateFee(uint256 _value, bool _recover, bytes32 _feeType)
        public
        view
        validFeeType(_feeType)
        returns (uint256)
    {
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
        uintStorage[HOME_FEE_STORAGE_KEY] = _fee;
        emit HomeFeeUpdated(_fee);
    }

    function getHomeFee() public view returns (uint256) {
        return uintStorage[HOME_FEE_STORAGE_KEY];
    }

    function setForeignFee(uint256 _fee) external validFee(_fee) {
        uintStorage[FOREIGN_FEE_STORAGE_KEY] = _fee;
        emit ForeignFeeUpdated(_fee);
    }

    function getForeignFee() public view returns (uint256) {
        return uintStorage[FOREIGN_FEE_STORAGE_KEY];
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
