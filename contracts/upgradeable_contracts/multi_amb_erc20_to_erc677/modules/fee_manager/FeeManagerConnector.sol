pragma solidity 0.4.24;

import "openzeppelin-solidity/contracts/AddressUtils.sol";
import "../../../../interfaces/IBurnableMintableERC677Token.sol";
import "../../../Ownable.sol";
import "./HomeMultiAMBErc20ToErc677FeeManager.sol";

contract FeeManagerConnector is Ownable {
    bytes32 internal constant FEE_MANAGER_CONTRACT = 0x779a349c5bee7817f04c960f525ee3e2f2516078c38c68a3149787976ee837e5; // keccak256(abi.encodePacked("feeManagerContract"))
    bytes32 internal constant HOME_TO_FOREIGN_FEE = 0x741ede137d0537e88e0ea0ff25b1f22d837903dbbee8980b4a06e8523247ee26; // keccak256(abi.encodePacked("homeToForeignFee"))
    bytes32 internal constant FOREIGN_TO_HOME_FEE = 0x03be2b2875cb41e0e77355e802a16769bb8dfcf825061cde185c73bf94f12625; // keccak256(abi.encodePacked("foreignToHomeFee"))

    event FeeDistributed(uint256 fee, address indexed token, bytes32 indexed messageId);

    /**
    * @dev Updates an address of the used fee manager contract used for calculating and distributing fees.
    * @param _feeManager address of fee manager contract.
    */
    function setFeeManager(address _feeManager) external onlyOwner {
        require(_feeManager == address(0) || AddressUtils.isContract(_feeManager));
        addressStorage[FEE_MANAGER_CONTRACT] = _feeManager;
    }

    /**
    * @dev Retrieves an address of the fee manager contract.
    * @return address of the fee manager contract.
    */
    function feeManager() public view returns (HomeMultiAMBErc20ToErc677FeeManager) {
        return HomeMultiAMBErc20ToErc677FeeManager(addressStorage[FEE_MANAGER_CONTRACT]);
    }

    function _distributeFee(bytes32 _feeType, address _from, address _token, uint256 _value)
        internal
        returns (uint256)
    {
        HomeMultiAMBErc20ToErc677FeeManager manager = feeManager();
        if (address(manager) != address(0)) {
            if (_feeType == HOME_TO_FOREIGN_FEE && manager.isRewardAddress(_from)) {
                return 0;
            }
            uint256 fee = manager.initAndCalculateFee(_feeType, _token, _value);
            if (fee > 0) {
                if (_feeType == FOREIGN_TO_HOME_FEE) {
                    IBurnableMintableERC677Token(_token).mint(manager, fee);
                } else {
                    IBurnableMintableERC677Token(_token).transfer(manager, fee);
                }
                manager.distributeFee(_token, fee);
            }
            return fee;
        }
        return 0;
    }
}
