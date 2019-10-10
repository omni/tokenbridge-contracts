pragma solidity 0.4.24;

import "../upgradeable_contracts/BaseFeeManager.sol";

contract FeeManagerMock is BaseFeeManager {
    function distributeFeeFromAffirmation(uint256 _fee) external {
        // solhint-disable-previous-line no-empty-blocks
    }

    function distributeFeeFromSignatures(uint256 _fee) external {
        // solhint-disable-previous-line no-empty-blocks
    }

    function getFeeManagerMode() external pure returns (bytes4) {
        return 0xf2aed8f7; // bytes4(keccak256(abi.encodePacked("manages-one-direction")))
    }

    function randomTest(uint256 _count) external view returns (uint256) {
        return super.random(_count);
    }
}
