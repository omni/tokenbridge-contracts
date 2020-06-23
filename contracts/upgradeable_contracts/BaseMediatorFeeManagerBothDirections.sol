pragma solidity 0.4.24;

import "./BaseMediatorFeeManager.sol";

/**
* @title BaseMediatorFeeManagerBothDirections
* @dev Base fee manager to handle fees in both direction for AMB mediators.
*/
contract BaseMediatorFeeManagerBothDirections is BaseMediatorFeeManager {
    event OppositeFeeUpdated(uint256 fee);

    uint256 public oppositeFee;

    bool internal isOppositeDirection;

    /**
    * @dev Stores the initial parameters of the fee manager.
    * @param _owner address of the owner of the fee manager contract.
    * @param _fee the fee percentage amount.
    * @param _oppositeFee the fee percentage amount for the opposite direction.
    * @param _rewardAccountList list of addresses that will receive the fee rewards.
    */
    constructor(
        address _owner,
        uint256 _fee,
        uint256 _oppositeFee,
        address[] _rewardAccountList,
        address _mediatorContract
    ) public BaseMediatorFeeManager(_owner, _fee, _rewardAccountList, _mediatorContract) {
        _setOppositeFee(_oppositeFee);
    }

    /**
    * @dev Calculates the fee amount for the opposite direction to be subtracted from the value.
    * @param _value the base value from which fees are calculated
    */
    function calculateOppositeFee(uint256 _value) external view returns (uint256) {
        return _value.mul(oppositeFee).div(MAX_FEE);
    }

    /**
    * @dev Sets the fee percentage amount for the mediator operations in the opposite direction.
    * Only the owner can call this method.
    * @param _fee the fee percentage
    */
    function setOppositeFee(uint256 _fee) external onlyOwner {
        _setOppositeFee(_fee);
    }

    /**
    * @dev Distributes the provided amount of fees for operations in the opposite direction proportionally to the list of reward accounts.
    * In case the fees cannot be equally distributed, the remaining difference will be distributed to an account
    * in a semi-random way.
    * @param _fee total amount to be distributed to the list of reward accounts.
    */
    function distributeOppositeFee(uint256 _fee) public {
        isOppositeDirection = true;
        distributeFee(_fee);
        delete isOppositeDirection;
    }

    /**
    * @dev Stores the fee percentage amount for the mediator operations.
    * @param _fee the fee percentage
    */
    function _setOppositeFee(uint256 _fee) internal validFee(_fee) {
        oppositeFee = _fee;
        emit OppositeFeeUpdated(_fee);
    }
}
