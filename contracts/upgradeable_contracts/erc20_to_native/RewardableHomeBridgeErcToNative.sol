pragma solidity 0.4.24;

import "../RewardableBridge.sol";


contract RewardableHomeBridgeErcToNative is RewardableBridge {

    function setHomeFee(uint256 _fee) external onlyOwner {
        _setFee(feeManagerContract(), _fee, HOME_FEE);
    }

    function setForeignFee(uint256 _fee) external onlyOwner {
        _setFee(feeManagerContract(), _fee, FOREIGN_FEE);
    }

    function getHomeFee() public view returns(uint256) {
        return _getFee(HOME_FEE);
    }

    function getForeignFee() public view returns(uint256) {
        return _getFee(FOREIGN_FEE);
    }

    function isPOSDAOFeeManager() public view returns(bool) {
        bool mode;
        bytes memory callData = abi.encodeWithSignature("isPOSDAOFeeManager()");
        address feeManager = feeManagerContract();
        assembly {
            let result := callcode(gas, feeManager, 0x0, add(callData, 0x20), mload(callData), 0, 32)
            mode := mload(0)

            switch result
            case 0 { revert(0, 0) }
        }
        return mode;
    }
}
