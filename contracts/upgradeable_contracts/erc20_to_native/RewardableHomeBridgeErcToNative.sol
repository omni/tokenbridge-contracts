pragma solidity 0.4.24;

import "../RewardableBridge.sol";

contract RewardableHomeBridgeErcToNative is RewardableBridge {
    bytes4 internal constant GET_AMOUNT_TO_BURN = 0x916850e9; // getAmountToBurn(uint256)

    function setHomeFee(uint256) external onlyOwner {
        _delegateWriteToFeeManager(msg.data);
    }

    function setForeignFee(uint256) external onlyOwner {
        _delegateWriteToFeeManager(msg.data);
    }

    function getHomeFee() external view returns (uint256) {
        return _delegateReadToFeeManager(msg.data);
    }

    function getForeignFee() external view returns (uint256) {
        return _delegateReadToFeeManager(msg.data);
    }

    function getAmountToBurn(uint256 _value) public view returns (uint256) {
        bytes memory callData = abi.encodeWithSelector(GET_AMOUNT_TO_BURN, _value);
        return _delegateReadToFeeManager(callData);
    }
}
