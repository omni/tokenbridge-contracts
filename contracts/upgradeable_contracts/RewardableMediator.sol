pragma solidity 0.4.24;

import "./Ownable.sol";
import "openzeppelin-solidity/contracts/AddressUtils.sol";
import "../interfaces/IMediatorFeeManager.sol";

/**
* @title RewardableMediator
* @dev Common functionality to interact with mediator fee manager contract methods.
*/
contract RewardableMediator is Ownable {
    event FeeDistributed(uint256 feeAmount, bytes32 indexed messageId);

    bytes32 internal constant FEE_MANAGER_CONTRACT = 0x779a349c5bee7817f04c960f525ee3e2f2516078c38c68a3149787976ee837e5; // keccak256(abi.encodePacked("feeManagerContract"))
    bytes4 internal constant ON_TOKEN_TRANSFER = 0xa4c0ed36; // onTokenTransfer(address,uint256,bytes)

    /**
    * @dev Sets the fee manager contract address. Only the owner can call this method.
    * @param _feeManager the address of the fee manager contract.
    */
    function setFeeManagerContract(address _feeManager) external onlyOwner {
        _setFeeManagerContract(_feeManager);
    }

    /**
    * @dev Internal function for enabling new / disabling fee manage contract.
    * @param _feeManager the address of the fee manager contract.
    */
    function _setFeeManagerContract(address _feeManager) internal {
        require(_feeManager == address(0) || AddressUtils.isContract(_feeManager));
        addressStorage[FEE_MANAGER_CONTRACT] = _feeManager;
    }

    /**
    * @dev Tells the fee manager contract address
    * @return the address of the fee manager contract.
    */
    function feeManagerContract() public view returns (IMediatorFeeManager) {
        return IMediatorFeeManager(addressStorage[FEE_MANAGER_CONTRACT]);
    }

    /**
    * @dev Distributes the provided amount of fees.
    * @param _feeManager address of the fee manager contract
    * @param _fee total amount to be distributed to the list of reward accounts.
    * @param _messageId id of the message that generated fee distribution
    */
    function distributeFee(IMediatorFeeManager _feeManager, uint256 _fee, bytes32 _messageId) internal {
        onFeeDistribution(_feeManager, _fee);
        _feeManager.call(abi.encodeWithSelector(ON_TOKEN_TRANSFER, address(this), _fee, ""));
        emit FeeDistributed(_fee, _messageId);
    }

    /* solcov ignore next */
    function onFeeDistribution(address _feeManager, uint256 _fee) internal;
}
