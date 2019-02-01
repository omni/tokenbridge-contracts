pragma solidity 0.4.24;

import "./Ownable.sol";
import "./FeeTypes.sol";


contract RewardableBridge is Ownable, FeeTypes {

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

    function _getFee(bytes32 _feeType) public view returns(uint256) {
        uint256 fee;
        address feeManager = feeManagerContract();
        string memory method = _feeType == HOME_FEE ? "getHomeFee()" : "getForeignFee()";
        bytes memory callData = abi.encodeWithSignature(method);

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
        bytes memory callData = abi.encodeWithSignature("getFeeManagerMode()");
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
        return addressStorage[keccak256(abi.encodePacked("feeManagerContract"))];
    }

    function setFeeManagerContract(address _feeManager) public onlyOwner {
        require(_feeManager == address(0) || isContract(_feeManager));
        addressStorage[keccak256(abi.encodePacked("feeManagerContract"))] = _feeManager;
    }

    function _setFee(address _feeManager, uint256 _fee, bytes32 _feeType) internal {
        string memory method = _feeType == HOME_FEE ? "setHomeFee(uint256)" : "setForeignFee(uint256)";
        require(_feeManager.delegatecall(abi.encodeWithSignature(method, _fee)));
    }

    function isContract(address _addr) internal view returns (bool)
    {
        uint length;
        assembly { length := extcodesize(_addr) }
        return length > 0;
    }

    function calculateFee(uint256 _value, bool _recover, address _impl, bytes32 _feeType) internal view returns(uint256) {
        uint256 fee;
        bytes memory callData = abi.encodeWithSignature("calculateFee(uint256,bool,bytes32)", _value, _recover, _feeType);
        assembly {
            let result := callcode(gas, _impl, 0x0, add(callData, 0x20), mload(callData), 0, 32)
            fee := mload(0)

            switch result
            case 0 { revert(0, 0) }
        }
        return fee;
    }

    function distributeFeeFromSignatures(uint256 _fee, address _feeManager) internal {
        require(_feeManager.delegatecall(abi.encodeWithSignature("distributeFeeFromSignatures(uint256)", _fee)));
    }

    function distributeFeeFromAffirmation(uint256 _fee, address _feeManager) internal {
        require(_feeManager.delegatecall(abi.encodeWithSignature("distributeFeeFromAffirmation(uint256)", _fee)));
    }
}
