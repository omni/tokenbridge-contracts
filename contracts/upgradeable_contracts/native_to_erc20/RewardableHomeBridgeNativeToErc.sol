pragma solidity 0.4.24;

import "../RewardableBridge.sol";


contract RewardableHomeBridgeNativeToErc is RewardableBridge {

    function setForeignFee(uint256 _fee) external onlyOwner {
        _setFee(feeManagerContract(), _fee, FOREIGN_FEE);
    }

    function setHomeFee(uint256 _fee) external onlyOwner {
        _setFee(feeManagerContract(), _fee, HOME_FEE);
    }

    function getForeignFee() public view returns(uint256) {
        return _getFee(FOREIGN_FEE);
    }

    function getHomeFee() public view returns(uint256) {
        return _getFee(HOME_FEE);
    }

    function onRequestForSignature(uint256 _value, address _impl) internal view returns(uint256) {
        uint256 returnedValue;
        bytes memory callData = abi.encodeWithSignature("onRequestForSignature(uint256)", _value);
        assembly {
            let result := callcode(gas, _impl, 0x0, add(callData, 0x20), mload(callData), 0, 32)
            returnedValue := mload(0)

            switch result
            case 0 { revert(0, 0) }
        }
        return returnedValue;
    }

    function distributeFeeOnSignaturesCollected(uint256 _fee, address _feeManager) internal {
        require(_feeManager.delegatecall(abi.encodeWithSignature("onSignaturesCollected(uint256)", _fee)));
    }
}
