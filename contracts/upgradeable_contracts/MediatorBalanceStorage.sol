pragma solidity 0.4.24;

import "../upgradeability/EternalStorage.sol";

/**
 * @title MediatorBalanceStorage
 * @dev Storage helpers for the mediator balance tracking.
 */
contract MediatorBalanceStorage is EternalStorage {
    bytes32 internal constant MEDIATOR_BALANCE = 0x3db340e280667ee926fa8c51e8f9fcf88a0ff221a66d84d63b4778127d97d139; // keccak256(abi.encodePacked("mediatorBalance"))

    /**
     * @dev Tells the expected mediator balance.
     * @return the current expected mediator balance.
     */
    function mediatorBalance() public view returns (uint256) {
        return uintStorage[MEDIATOR_BALANCE];
    }

    /**
     * @dev Sets the expected mediator balance of the contract.
     * @param _balance the new expected mediator balance value.
     */
    function _setMediatorBalance(uint256 _balance) internal {
        uintStorage[MEDIATOR_BALANCE] = _balance;
    }
}
