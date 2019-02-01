pragma solidity 0.4.24;

import "./Ownable.sol";


contract RewardableBridge is Ownable {

    function setFee(uint256 _fee) external onlyOwner {
        _setFee(feeManagerContract(), _fee);
    }

    function getFee() public view returns(uint256) {
        uint256 fee;
        bytes memory callData = abi.encodeWithSignature("getFee()");
        address feeManager = feeManagerContract();
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

    function _setFee(address _feeManager, uint256 _fee) internal {
        require(_feeManager.delegatecall(abi.encodeWithSignature("setFee(uint256)", _fee)));
    }

    function isContract(address _addr) internal view returns (bool)
    {
        uint length;
        assembly { length := extcodesize(_addr) }
        return length > 0;
    }

    function calculateFee(uint256 _value, bool _recover, address _impl) internal view returns(uint256) {
        uint256 fee;
        bytes memory callData = abi.encodeWithSignature("calculateFee(uint256,bool)", _value, _recover);
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
