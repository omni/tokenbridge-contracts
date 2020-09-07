pragma solidity 0.4.24;

import "openzeppelin-solidity/contracts/token/ERC20/ERC20Basic.sol";
import "openzeppelin-solidity/contracts/AddressUtils.sol";
import "../BaseMediatorFeeManager.sol";

/**
 * @title ForeignFeeManagerAMBNativeToErc20
 * @dev Implements the logic to distribute fees from the native to erc20 mediator contract operations.
 * The fees are distributed in the form of tokens to the list of reward accounts.
 */
contract ForeignFeeManagerAMBNativeToErc20 is BaseMediatorFeeManager {
    address public token;

    /**
     * @dev Stores the initial parameters of the fee manager.
     * @param _owner address of the owner of the fee manager contract.
     * @param _fee the fee percentage amount.
     * @param _rewardAccountList list of addresses that will receive the fee rewards.
     * @param _token address of the token in which the fees will be received.
     */
    constructor(
        address _owner,
        uint256 _fee,
        address[] _rewardAccountList,
        address _mediatorContract,
        address _token
    ) public BaseMediatorFeeManager(_owner, _fee, _rewardAccountList, _mediatorContract) {
        _setToken(_token);
    }

    /**
     * @dev Sets the token address.
     * Only the owner can call this method.
     * @param _newToken address of the token in which the fees will be received.
     */
    function setToken(address _newToken) external onlyOwner {
        _setToken(_newToken);
    }

    /**
     * @dev Stores the token address.
     * @param _newToken address of the token in which the fees will be received.
     */
    function _setToken(address _newToken) internal {
        require(AddressUtils.isContract(_newToken));
        token = _newToken;
    }

    /**
     * @dev Transfer the fee amount of tokens to the reward account.
     * @param _rewardAddress address that will receive the tokens.
     * @param _fee amount of tokens to be transferred.
     */
    function onFeeDistribution(address _rewardAddress, uint256 _fee) internal {
        ERC20Basic(token).transfer(_rewardAddress, _fee);
    }
}
