pragma solidity 0.4.24;

import "../RewardableBridge.sol";

contract RewardableHomeBridgeErcToNative is RewardableBridge {
    bytes4 internal constant GET_AMOUNT_TO_BURN = 0x916850e9; // getAmountToBurn(uint256)

    function setHomeFee(uint256 _fee) external onlyOwner {
        _setFee(feeManagerContract(), _fee, HOME_FEE);
    }

    function setForeignFee(uint256 _fee) external onlyOwner {
        _setFee(feeManagerContract(), _fee, FOREIGN_FEE);
    }

    function getHomeFee() public view returns (uint256) {
        return _getFee(HOME_FEE);
    }

    function getForeignFee() public view returns (uint256) {
        return _getFee(FOREIGN_FEE);
    }

    function getAmountToBurn(uint256 _value) public view returns (uint256) {
        uint256 amount;
        bytes memory callData = abi.encodeWithSelector(GET_AMOUNT_TO_BURN, _value);
        address feeManager = feeManagerContract();
        assembly {
            let result := callcode(gas, feeManager, 0x0, add(callData, 0x20), mload(callData), 0, 32)
            amount := mload(0)

            switch result
                case 0 {
                    revert(0, 0)
                }
        }
        return amount;
    }
}
