pragma solidity 0.4.24;

import "../upgradeability/EternalStorage.sol";
import "../IFeeManager.sol";
import "../libraries/SafeMath.sol";

contract BaseFeeManager is EternalStorage {
    using SafeMath for uint256;

    event FeeUpdated(uint256 fee, uint256 fee);

    function calculateFee(uint256 _value, bool _recover) external view returns(uint256) {
        uint256 fee = getFee();
        uint256 eth = 1 ether;
        if (!_recover) {
            return _value.mul(fee).div(eth);
        }
        return _value.mul(fee).div(eth.sub(fee)); // value * fee / (1 ether - fee)
    }

    function distributeFeeFromSignatures(uint256 _fee) external {
    }

    function distributeFeeFromAffirmation(uint256 _fee) external {
    }

    function setFee(uint256 _fee) external {
        uint256 fee = _fee.mul(1 ether);
        uintStorage[keccak256(abi.encodePacked("fee"))] = fee;
        emit FeeUpdated(_fee, fee);
    }

    function getFee() public view returns(uint256) {
        return uintStorage[keccak256(abi.encodePacked("fee"))];
    }
}
