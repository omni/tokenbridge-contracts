pragma solidity 0.4.19;

import "./Ownable.sol";
import "./FeeTypes.sol";


contract RewardableBridge is Ownable, FeeTypes {

    function _getFee(bytes32 _feeType) internal view returns(uint256) {
        uint256 fee;
        address feeManager = feeManagerContract();
        string memory method = _feeType == HOME_FEE ? "getHomeFee()" : "getForeignFee()";
        bytes4 callData = bytes4(keccak256(method));

        assembly {
            let result := callcode(gas, feeManager, 0x0, add(callData, 0x20), mload(callData), 0, 32)
            fee := mload(0)

            switch result
            case 0 { revert(0, 0) }
        }
        return fee;
    }

    function getFeeManagerMode() public view returns(bytes4) {
        bytes4 mode;
        bytes4 callData = bytes4(keccak256("getFeeManagerMode()"));
        address feeManager = feeManagerContract();
        assembly {
            let result := callcode(gas, feeManager, 0x0, add(callData, 0x20), mload(callData), 0, 4)
            mode := mload(0)

            switch result
            case 0 { revert(0, 0) }
        }
        return mode;
    }

    function feeManagerContract() public view returns(address) {
        return addressStorage[keccak256("feeManagerContract")];
    }

    function setFeeManagerContract(address _feeManager) public onlyOwner {
        require(_feeManager == address(0) || isContract(_feeManager));
        addressStorage[keccak256("feeManagerContract")] = _feeManager;
    }

    function _setFee(address _feeManager, uint256 _fee, bytes32 _feeType) internal {
        string memory method = _feeType == HOME_FEE ? "setHomeFee(uint256)" : "setForeignFee(uint256)";
        require(_feeManager.delegatecall(bytes4(keccak256(method)), _fee));
    }

    function isContract(address _addr) internal view returns (bool)
    {
        uint length;
        assembly { length := extcodesize(_addr) }
        return length > 0;
    }

    function calculateFee(uint256 _value, bool _recover, address _impl, bytes32 _feeType) internal view returns(uint256) {
        uint256 fee;
        bytes4 sig = bytes4(keccak256("calculateFee(uint256,bool,bytes32)"));
        assembly {
            let callData := mload(0x40)
            mstore(callData,sig)
            mstore(add(callData,0x04),_value)
            mstore(add(callData,0x24),_recover)
            mstore(add(callData,0x25),_feeType)
            let result := callcode(gas, _impl, 0x0, callData, 0x45, 0, 32)
            fee := mload(0)
            mstore(0x40,add(callData,0x45))
            switch result
            case 0 { revert(0, 0) }
        }
        return fee;
    }

    function distributeFeeFromSignatures(uint256 _fee, address _feeManager) internal {
        require(_feeManager.delegatecall(bytes4(keccak256("distributeFeeFromSignatures(uint256)")), _fee));
    }

    function distributeFeeFromAffirmation(uint256 _fee, address _feeManager) internal {
        require(_feeManager.delegatecall(bytes4(keccak256("distributeFeeFromAffirmation(uint256)")), _fee));
    }
}
