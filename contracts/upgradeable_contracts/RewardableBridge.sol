pragma solidity 0.4.24;

import "openzeppelin-solidity/contracts/AddressUtils.sol";
import "./Ownable.sol";
import "./FeeTypes.sol";

/**
 * @title RewardableBridge
 * @dev Common functionality for fee management logic delegation to the separate fee management contract.
 */
contract RewardableBridge is Ownable, FeeTypes {
    event FeeDistributedFromAffirmation(uint256 feeAmount, bytes32 indexed transactionHash);
    event FeeDistributedFromSignatures(uint256 feeAmount, bytes32 indexed transactionHash);

    bytes32 internal constant FEE_MANAGER_CONTRACT = 0x779a349c5bee7817f04c960f525ee3e2f2516078c38c68a3149787976ee837e5; // keccak256(abi.encodePacked("feeManagerContract"))
    bytes4 internal constant GET_HOME_FEE = 0x94da17cd; // getHomeFee()
    bytes4 internal constant GET_FOREIGN_FEE = 0xffd66196; // getForeignFee()
    bytes4 internal constant GET_FEE_MANAGER_MODE = 0xf2ba9561; // getFeeManagerMode()
    bytes4 internal constant SET_HOME_FEE = 0x34a9e148; // setHomeFee(uint256)
    bytes4 internal constant SET_FOREIGN_FEE = 0x286c4066; // setForeignFee(uint256)
    bytes4 internal constant CALCULATE_FEE = 0x9862f26f; // calculateFee(uint256,bool,bytes32)
    bytes4 internal constant DISTRIBUTE_FEE_FROM_SIGNATURES = 0x59d78464; // distributeFeeFromSignatures(uint256)
    bytes4 internal constant DISTRIBUTE_FEE_FROM_AFFIRMATION = 0x054d46ec; // distributeFeeFromAffirmation(uint256)

    /**
     * @dev Internal function for reading the fee value from the fee manager.
     * @param _feeType type of the fee, should be either HOME_FEE of FOREIGN_FEE.
     * @return retrieved fee percentage.
     */
    function _getFee(bytes32 _feeType) internal view validFeeType(_feeType) returns (uint256 fee) {
        address feeManager = feeManagerContract();
        bytes4 method = _feeType == HOME_FEE ? GET_HOME_FEE : GET_FOREIGN_FEE;
        bytes memory callData = abi.encodeWithSelector(method);

        assembly {
            let result := callcode(gas, feeManager, 0x0, add(callData, 0x20), mload(callData), 0, 32)

            if and(eq(returndatasize, 32), result) {
                fee := mload(0)
            }
        }
    }

    /**
     * @dev Retrieves the mode of the used fee manager.
     * @return manager mode identifier, or zero bytes otherwise.
     */
    function getFeeManagerMode() external view returns (bytes4 mode) {
        bytes memory callData = abi.encodeWithSelector(GET_FEE_MANAGER_MODE);
        address feeManager = feeManagerContract();
        assembly {
            let result := callcode(gas, feeManager, 0x0, add(callData, 0x20), mload(callData), 0, 4)

            if and(eq(returndatasize, 32), result) {
                mode := mload(0)
            }
        }
    }

    /**
     * @dev Retrieves the address of the fee manager contract used.
     * @return address of the fee manager contract.
     */
    function feeManagerContract() public view returns (address) {
        return addressStorage[FEE_MANAGER_CONTRACT];
    }

    /**
     * @dev Updates the address of the used fee manager contract.
     * Only contract owner can call this method.
     * If during this operation, home fee is changed, it is highly recommended to stop the bridge operations first.
     * Otherwise, pending signature requests can become a reason for imbalance between two bridge sides.
     * @param _feeManager address of the new fee manager contract, or zero address to disable fee collection.
     */
    function setFeeManagerContract(address _feeManager) external onlyOwner {
        require(_feeManager == address(0) || AddressUtils.isContract(_feeManager));
        addressStorage[FEE_MANAGER_CONTRACT] = _feeManager;
    }

    /**
     * @dev Internal function for setting the fee value by using the fee manager.
     * @param _feeManager address of the fee manager contract.
     * @param _fee new value for fee percentage amount.
     * @param _feeType type of the fee, should be either HOME_FEE of FOREIGN_FEE.
     */
    function _setFee(address _feeManager, uint256 _fee, bytes32 _feeType) internal validFeeType(_feeType) {
        bytes4 method = _feeType == HOME_FEE ? SET_HOME_FEE : SET_FOREIGN_FEE;
        require(_feeManager.delegatecall(abi.encodeWithSelector(method, _fee)));
    }

    /**
     * @dev Calculates the exact fee amount by using the fee manager.
     * @param _value transferred value for which fee should be calculated.
     * @param _recover true, if the fee was already subtracted from the given _value and needs to be restored.
     * @param _impl address of the fee manager contract.
     * @param _feeType type of the fee, should be either HOME_FEE of FOREIGN_FEE.
     * @return calculated fee amount.
     */
    function calculateFee(uint256 _value, bool _recover, address _impl, bytes32 _feeType)
        internal
        view
        returns (uint256 fee)
    {
        bytes memory callData = abi.encodeWithSelector(CALCULATE_FEE, _value, _recover, _feeType);
        assembly {
            let result := callcode(gas, _impl, 0x0, add(callData, 0x20), mload(callData), 0, 32)

            switch and(eq(returndatasize, 32), result)
                case 1 {
                    fee := mload(0)
                }
                default {
                    revert(0, 0)
                }
        }
    }

    /**
     * @dev Internal function for distributing the fee for collecting sufficient amount of signatures.
     * @param _fee amount of fee to distribute.
     * @param _feeManager address of the fee manager contract.
     * @param _txHash reference transaction hash where the original bridge request happened.
     */
    function distributeFeeFromSignatures(uint256 _fee, address _feeManager, bytes32 _txHash) internal {
        if (_fee > 0) {
            require(_feeManager.delegatecall(abi.encodeWithSelector(DISTRIBUTE_FEE_FROM_SIGNATURES, _fee)));
            emit FeeDistributedFromSignatures(_fee, _txHash);
        }
    }

    /**
     * @dev Internal function for distributing the fee for collecting sufficient amount of affirmations.
     * @param _fee amount of fee to distribute.
     * @param _feeManager address of the fee manager contract.
     * @param _txHash reference transaction hash where the original bridge request happened.
     */
    function distributeFeeFromAffirmation(uint256 _fee, address _feeManager, bytes32 _txHash) internal {
        if (_fee > 0) {
            require(_feeManager.delegatecall(abi.encodeWithSelector(DISTRIBUTE_FEE_FROM_AFFIRMATION, _fee)));
            emit FeeDistributedFromAffirmation(_fee, _txHash);
        }
    }
}
