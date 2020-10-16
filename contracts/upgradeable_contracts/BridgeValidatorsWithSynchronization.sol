pragma solidity 0.4.24;

import "./BridgeValidators.sol";
import "./BasicAMBMediator.sol";

contract BridgeValidatorsWithSynchronization is BridgeValidators, BasicAMBMediator {
    function initialize(
        uint256 _requiredSignatures,
        address[] _initialValidators,
        address _owner,
        address _bridgeContract,
        address _validatorContractOnOtherSide
    ) public returns (bool) {
        _setBridgeContract(_bridgeContract);
        _setMediatorContractOnOtherSide(_validatorContractOnOtherSide);

        return super.initialize(_requiredSignatures, _initialValidators, _owner);
    }

    modifier synchronize {
        IAMB bridge = bridgeContract();
        address validatorContract = mediatorContractOnOtherSide();
        if (msg.sender == owner()) {
            bridge.requireToPassMessage(validatorContract, msg.data, requestGasLimit());
        } else {
            require(msg.sender == address(bridge) && bridge.messageSender() == validatorContract);
        }
        _;
    }

    function addValidator(address _validator) external synchronize {
        _addValidator(_validator);
        emit ValidatorAdded(_validator);
    }

    function removeValidator(address _validator) external synchronize {
        _removeValidator(_validator);
        emit ValidatorRemoved(_validator);
    }
}
