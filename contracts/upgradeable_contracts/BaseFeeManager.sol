pragma solidity 0.4.24;

import "../upgradeability/EternalStorage.sol";
import "../libraries/SafeMath.sol";
import "../IRewardableValidators.sol";
import "./FeeTypes.sol";


contract BaseFeeManager is EternalStorage, FeeTypes {
    using SafeMath for uint256;

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

    function distributeFeeFromAffirmation(uint256 _fee) external;

    function distributeFeeFromSignatures(uint256 _fee) external;

    function getFeeManagerMode() public pure returns(bytes4);

    function random(uint256 _count) public view returns(uint256) {
        return uint256(blockhash(block.number.sub(1))) % _count;
    }
}
