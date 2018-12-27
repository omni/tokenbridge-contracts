pragma solidity 0.4.24;

import "../upgradeability/EternalStorage.sol";
import "../IFeeManager.sol";

contract FeeManagerHelpers is EternalStorage {
    function feeManagerContract() public view returns(IFeeManager) {
        return IFeeManager(addressStorage[keccak256(abi.encodePacked("feeManagerContract"))]);
    }
}
