pragma solidity 0.4.24;

import "openzeppelin-solidity/contracts/AddressUtils.sol";
import "./Ownable.sol";
import "./FeeTypes.sol";

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

    function _getFee(bytes32 _feeType) internal view returns (uint256) {
        uint256 fee;
        address feeManager = feeManagerContract();
        bytes4 method = _feeType == HOME_FEE ? GET_HOME_FEE : GET_FOREIGN_FEE;
        bytes memory callData = abi.encodeWithSelector(method);

        assembly {
            let result := callcode(gas, feeManager, 0x0, add(callData, 0x20), mload(callData), 0, 32)
            fee := mload(0)

            switch result
                case 0 {
                    revert(0, 0)
                }
        }
        return fee;
    }

    function getFeeManagerMode() external view returns (bytes4) {
        bytes4 mode;
        bytes memory callData = abi.encodeWithSelector(GET_FEE_MANAGER_MODE);
        address feeManager = feeManagerContract();
        assembly {
            let result := callcode(gas, feeManager, 0x0, add(callData, 0x20), mload(callData), 0, 4)
            mode := mload(0)

            switch result
                case 0 {
                    revert(0, 0)
                }
        }
        return mode;
    }

    function feeManagerContract() public view returns (address) {
        return addressStorage[FEE_MANAGER_CONTRACT];
    }

    function setFeeManagerContract(address _feeManager) external onlyOwner {
        require(_feeManager == address(0) || AddressUtils.isContract(_feeManager));
        addressStorage[FEE_MANAGER_CONTRACT] = _feeManager;
    }

    function _setFee(
        address _feeManager,
        uint256 _fee,
        bytes32 _feeType
    ) internal {
        bytes4 method = _feeType == HOME_FEE ? SET_HOME_FEE : SET_FOREIGN_FEE;
        require(_feeManager.delegatecall(abi.encodeWithSelector(method, _fee)));
    }

    function calculateFee(
        uint256 _value,
        bool _recover,
        address _impl,
        bytes32 _feeType
    ) internal view returns (uint256) {
        uint256 fee;
        bytes memory callData = abi.encodeWithSelector(CALCULATE_FEE, _value, _recover, _feeType);
        assembly {
            let result := callcode(gas, _impl, 0x0, add(callData, 0x20), mload(callData), 0, 32)
            fee := mload(0)

            switch result
                case 0 {
                    revert(0, 0)
                }
        }
        return fee;
    }

    function distributeFeeFromSignatures(
        uint256 _fee,
        address _feeManager,
        bytes32 _txHash
    ) internal {
        require(_feeManager.delegatecall(abi.encodeWithSelector(DISTRIBUTE_FEE_FROM_SIGNATURES, _fee)));
        emit FeeDistributedFromSignatures(_fee, _txHash);
    }

    function distributeFeeFromAffirmation(
        uint256 _fee,
        address _feeManager,
        bytes32 _txHash
    ) internal {
        require(_feeManager.delegatecall(abi.encodeWithSelector(DISTRIBUTE_FEE_FROM_AFFIRMATION, _fee)));
        emit FeeDistributedFromAffirmation(_fee, _txHash);
    }
}
