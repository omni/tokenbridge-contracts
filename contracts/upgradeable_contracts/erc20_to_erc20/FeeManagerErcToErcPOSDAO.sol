pragma solidity 0.4.24;

import "../BlockRewardFeeManager.sol";

contract FeeManagerErcToErcPOSDAO is BlockRewardFeeManager {

    function getFeeManagerMode() public pure returns(bytes4) {
        return bytes4(keccak256(abi.encodePacked("manages-both-directions")));
    }
}
