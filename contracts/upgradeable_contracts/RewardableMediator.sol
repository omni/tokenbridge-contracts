pragma solidity 0.4.24;

import "./Ownable.sol";
import "openzeppelin-solidity/contracts/AddressUtils.sol";

/**
* @title RewardableMediator
* @dev Common functionality to interact with mediator fee manager logic contract methods.
* The fee manager is used as a logic contract only, the state variables are stored in the mediator contract,
* so methods should be invoked by using delegatecall or callcode.
*/
contract RewardableMediator is Ownable {
    event FeeDistributed(uint256 feeAmount, bytes32 indexed transactionHash);

    bytes32 internal constant FEE_MANAGER_CONTRACT = 0x779a349c5bee7817f04c960f525ee3e2f2516078c38c68a3149787976ee837e5; // keccak256(abi.encodePacked("feeManagerContract"))
    bytes4 internal constant GET_FEE = 0xced72f87; // getFee()
    bytes4 internal constant SET_FEE = 0x69fe0e2d; // setFee(uint256)
    bytes4 internal constant CALCULATE_FEE = 0x99a5d747; // calculateFee(uint256)
    bytes4 internal constant DISTRIBUTE_FEE = 0x05cc49dd; // distributeFee(uint256)
    bytes4 internal constant INITIALIZE_REWARD_ACCOUNTS = 0x3c098024; // initializeRewardAccounts(address[])
    bytes4 internal constant REWARD_ACCOUNTS = 0xe43fab31; // rewardAccounts()
    bytes4 internal constant ADD_REWARD_ACCOUNT = 0xe219bdc6; // addRewardAccount(address)
    bytes4 internal constant REMOVE_REWARD_ACCOUNT = 0x4692d9b4; // removeRewardAccount(address)

    /**
    * @dev Sets the fee manager contract address. Only the owner can call this method.
    * @param _feeManager the address of the fee manager contract.
    */
    function setFeeManagerContract(address _feeManager) external onlyOwner {
        require(_feeManager == address(0) || AddressUtils.isContract(_feeManager));
        addressStorage[FEE_MANAGER_CONTRACT] = _feeManager;
    }

    /**
    * @dev Sets the fee percentage amount for the operations. Only the owner can call this method.
    * The logic of how the fee is stored is delegated to the fee manager contract.
    * @param _fee the fee percentage
    */
    function setFee(uint256 _fee) external onlyOwner {
        _setFee(feeManagerContract(), _fee);
    }

    /**
    * @dev Adds a new account to the list of accounts to receive rewards for the operations. Only the owner can call this method.
    * The logic of how the list of reward accounts is stored is delegated to the fee manager contract.
    * @param _account new reward account
    */
    function addRewardAccount(address _account) external onlyOwner {
        require(feeManagerContract().delegatecall(abi.encodeWithSelector(ADD_REWARD_ACCOUNT, _account)));
    }

    /**
    * @dev Removes an account from the list of accounts to receive rewards for the operations. Only the owner can call this method.
    * The logic of how the list of reward accounts is stored is delegated to the fee manager contract.
    * @param _account to be removed
    */
    function removeRewardAccount(address _account) external onlyOwner {
        require(feeManagerContract().delegatecall(abi.encodeWithSelector(REMOVE_REWARD_ACCOUNT, _account)));
    }

    /**
    * @dev Tells the list of accounts that receives rewards for the operations.
    * In order to be able to get the returned value the assembly delegatecall is needed to be used.
    * @return the list of reward accounts
    */
    function rewardAccounts() external view returns (address[]) {
        address[] memory accounts;
        address feeManager = feeManagerContract();
        bytes memory callData = abi.encodeWithSelector(REWARD_ACCOUNTS);

        assembly {
            let result := delegatecall(gas, feeManager, add(callData, 0x20), mload(callData), 0, 0)
            returndatacopy(accounts, 0, returndatasize)

            switch result
                case 0 {
                    revert(0, 0)
                }
        }
        return accounts;
    }

    /**
    * @dev Tells the fee percentage amount for the mediator operations.
    * In order to be able to get the returned value the assembly delegatecall is needed to be used.
    * @return the fee percentage amount
    */
    function getFee() external view returns (uint256) {
        uint256 fee;
        address feeManager = feeManagerContract();
        bytes memory callData = abi.encodeWithSelector(GET_FEE);

        assembly {
            let result := delegatecall(gas, feeManager, add(callData, 0x20), mload(callData), 0, 32)
            fee := mload(0)

            switch result
                case 0 {
                    revert(0, 0)
                }
        }
        return fee;
    }

    /**
    * @dev Tells the fee manager contract address
    * @return the address of the fee manager contract.
    */
    function feeManagerContract() public view returns (address) {
        return addressStorage[FEE_MANAGER_CONTRACT];
    }

    /**
    * @dev Initialize the list of accounts that receives rewards for the mediator operations.
    * The logic of how the list of reward accounts is stored is delegated to the fee manager contract.
    * @param _accounts list of accounts
    */
    function _initializeRewardAccounts(address[] _accounts) internal {
        require(feeManagerContract().delegatecall(abi.encodeWithSelector(INITIALIZE_REWARD_ACCOUNTS, _accounts)));
    }

    /**
    * @dev Stores the fee percentage amount for the operations.
    * The logic of how the fee is stored is delegated to the fee manager contract.
    * @param _feeManager address of the fee manager contract
    * @param _fee the fee percentage
    */
    function _setFee(address _feeManager, uint256 _fee) internal {
        require(_feeManager.delegatecall(abi.encodeWithSelector(SET_FEE, _fee)));
    }

    /**
    * @dev Calculates the fee amount to be subtracted from the value.
    * The logic of how the fee is calculated is delegated to the fee manager contract.
    * In order to be able to get the returned value the assembly delegatecall is needed to be used.
    * @param _feeManager address of the fee manager contract
    * @param _value the base value from which fees are calculated
    */
    function calculateFee(address _feeManager, uint256 _value) internal view returns (uint256) {
        uint256 fee;
        bytes memory callData = abi.encodeWithSelector(CALCULATE_FEE, _value);
        assembly {
            let result := delegatecall(gas, _feeManager, add(callData, 0x20), mload(callData), 0, 32)
            fee := mload(0)

            switch result
                case 0 {
                    revert(0, 0)
                }
        }
        return fee;
    }

    /**
    * @dev Distributes the fee amount to the list of reward accounts.
    * The logic of how the fees are distributed is delegated to the fee manager contract.
    * @param _feeManager address of the fee manager contract
    * @param _fee the fee percentage
    */
    function distributeFee(address _feeManager, uint256 _fee, bytes32 _txHash) internal {
        require(_feeManager.delegatecall(abi.encodeWithSelector(DISTRIBUTE_FEE, _fee)));
        emit FeeDistributed(_fee, _txHash);
    }
}
