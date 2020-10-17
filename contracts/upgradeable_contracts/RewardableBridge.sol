pragma solidity 0.4.24;

import "openzeppelin-solidity/contracts/AddressUtils.sol";
import "./Ownable.sol";
import "./FeeTypes.sol";

contract RewardableBridge is Ownable, FeeTypes {
    event FeeDistributedFromAffirmation(uint256 feeAmount, bytes32 indexed transactionHash);
    event FeeDistributedFromSignatures(uint256 feeAmount, bytes32 indexed transactionHash);

    bytes32 internal constant FEE_MANAGER_CONTRACT = 0x779a349c5bee7817f04c960f525ee3e2f2516078c38c68a3149787976ee837e5; // keccak256(abi.encodePacked("feeManagerContract"))
    bytes4 internal constant SET_HOME_FEE = 0x34a9e148; // setHomeFee(uint256)
    bytes4 internal constant SET_FOREIGN_FEE = 0x286c4066; // setForeignFee(uint256)
    bytes4 internal constant CALCULATE_FEE = 0x9862f26f; // calculateFee(uint256,bool,bytes32)
    bytes4 internal constant DISTRIBUTE_FEE_FROM_SIGNATURES = 0x59d78464; // distributeFeeFromSignatures(uint256)
    bytes4 internal constant DISTRIBUTE_FEE_FROM_AFFIRMATION = 0x054d46ec; // distributeFeeFromAffirmation(uint256)

    function getFeeManagerMode() external view returns (bytes4) {
        // double conversion is needed here since bytes4(uint256) will return last for bytes
        // but fee manager mode is located in the first 4 bytes
        return bytes4(bytes32(_delegateReadToFeeManager(msg.data)));
    }

    function feeManagerContract() public view returns (address) {
        return addressStorage[FEE_MANAGER_CONTRACT];
    }

    function setFeeManagerContract(address _feeManager) external onlyOwner {
        require(_feeManager == address(0) || AddressUtils.isContract(_feeManager));
        addressStorage[FEE_MANAGER_CONTRACT] = _feeManager;
    }

    function _setFee(address _feeManager, uint256 _fee, bytes32 _feeType) internal validFeeType(_feeType) {
        bytes4 method = _feeType == HOME_FEE ? SET_HOME_FEE : SET_FOREIGN_FEE;
        require(_feeManager.delegatecall(abi.encodeWithSelector(method, _fee)));
    }

    function calculateFee(uint256 _value, bool _recover, address _impl, bytes32 _feeType)
        internal
        view
        returns (uint256)
    {
        bytes memory callData = abi.encodeWithSelector(CALCULATE_FEE, _value, _recover, _feeType);
        return _delegateReadToFeeManager(_impl, callData);
    }

    function distributeFeeFromSignatures(uint256 _fee, address _feeManager, bytes32 _txHash) internal {
        require(_feeManager.delegatecall(abi.encodeWithSelector(DISTRIBUTE_FEE_FROM_SIGNATURES, _fee)));
        emit FeeDistributedFromSignatures(_fee, _txHash);
    }

    function distributeFeeFromAffirmation(uint256 _fee, address _feeManager, bytes32 _txHash) internal {
        require(_feeManager.delegatecall(abi.encodeWithSelector(DISTRIBUTE_FEE_FROM_AFFIRMATION, _fee)));
        emit FeeDistributedFromAffirmation(_fee, _txHash);
    }

    /**
     * @dev Delegates the word read operation to the fee manager contract.
     * @param _feeManager address of the fee manager contract.
     * @param _callData calldata to pass to the fee manager.
     * @return one-word result
     */
    function _delegateReadToFeeManager(address _feeManager, bytes memory _callData)
        internal
        view
        returns (uint256 result)
    {
        assembly {
            callcode(gas, _feeManager, 0, add(_callData, 0x20), mload(_callData), 0, 32)
            pop

            switch returndatasize
                case 32 {
                    result := mload(0)
                }
                default {
                    result := 0
                }
        }
    }

    /**
     * @dev Delegates the word read operation to the fee manager contract.
     * @param _callData calldata to pass to the fee manager.
     * @return one-word result
     */
    function _delegateReadToFeeManager(bytes memory _callData) internal view returns (uint256) {
        return _delegateReadToFeeManager(feeManagerContract(), _callData);
    }

    /**
     * @dev Delegates the write operation to the fee manager contract.
     * @param _callData calldata to pass to the fee manager.
     */
    function _delegateWriteToFeeManager(bytes memory _callData) internal {
        address feeManager = feeManagerContract();
        require(feeManager.delegatecall(_callData));
    }
}
