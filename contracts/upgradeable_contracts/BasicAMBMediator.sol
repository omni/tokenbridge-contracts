pragma solidity 0.4.24;

import "./Ownable.sol";
import "../interfaces/IAMB.sol";
import "../libraries/Bytes.sol";
import "openzeppelin-solidity/contracts/AddressUtils.sol";

/**
* @title BasicAMBMediator
* @dev Basic storage and methods needed by mediators to interact with AMB bridge.
*/
contract BasicAMBMediator is Ownable {
    bytes32 internal constant BRIDGE_CONTRACT = 0x811bbb11e8899da471f0e69a3ed55090fc90215227fc5fb1cb0d6e962ea7b74f; // keccak256(abi.encodePacked("bridgeContract"))
    bytes32 internal constant MEDIATOR_CONTRACT = 0x98aa806e31e94a687a31c65769cb99670064dd7f5a87526da075c5fb4eab9880; // keccak256(abi.encodePacked("mediatorContract"))
    bytes32 internal constant REQUEST_GAS_LIMIT = 0x2dfd6c9f781bb6bbb5369c114e949b69ebb440ef3d4dd6b2836225eb1dc3a2be; // keccak256(abi.encodePacked("requestGasLimit"))

    /**
    * @dev Throws if caller on the other side is not an associated mediator.
    */
    modifier onlyMediator {
        require(msg.sender == address(bridgeContract()));
        require(messageSender() == mediatorContractOnOtherSide());
        _;
    }

    /**
    * @dev Sets the AMB bridge contract address. Only the owner can call this method.
    * @param _bridgeContract the address of the bridge contract.
    */
    function setBridgeContract(address _bridgeContract) external onlyOwner {
        _setBridgeContract(_bridgeContract);
    }

    /**
    * @dev Sets the mediator contract address from the other network. Only the owner can call this method.
    * @param _mediatorContract the address of the mediator contract.
    */
    function setMediatorContractOnOtherSide(address _mediatorContract) external onlyOwner {
        _setMediatorContractOnOtherSide(_mediatorContract);
    }

    /**
    * @dev Sets the gas limit to be used in the message execution by the AMB bridge on the other network.
    * This value can't exceed the parameter maxGasPerTx defined on the AMB bridge.
    * Only the owner can call this method.
    * @param _requestGasLimit the gas limit for the message execution.
    */
    function setRequestGasLimit(uint256 _requestGasLimit) external onlyOwner {
        _setRequestGasLimit(_requestGasLimit);
    }

    /**
    * @dev Get the AMB interface for the bridge contract address
    * @return AMB interface for the bridge contract address
    */
    function bridgeContract() public view returns (IAMB) {
        return IAMB(addressStorage[BRIDGE_CONTRACT]);
    }

    /**
    * @dev Tells the mediator contract address from the other network.
    * @return the address of the mediator contract.
    */
    function mediatorContractOnOtherSide() public view returns (address) {
        return addressStorage[MEDIATOR_CONTRACT];
    }

    /**
    * @dev Tells the gas limit to be used in the message execution by the AMB bridge on the other network.
    * @return the gas limit for the message execution.
    */
    function requestGasLimit() public view returns (uint256) {
        return uintStorage[REQUEST_GAS_LIMIT];
    }

    /**
    * @dev Stores a valid AMB bridge contract address.
    * @param _bridgeContract the address of the bridge contract.
    */
    function _setBridgeContract(address _bridgeContract) internal {
        require(AddressUtils.isContract(_bridgeContract));
        addressStorage[BRIDGE_CONTRACT] = _bridgeContract;
    }

    /**
    * @dev Stores the mediator contract address from the other network.
    * @param _mediatorContract the address of the mediator contract.
    */
    function _setMediatorContractOnOtherSide(address _mediatorContract) internal {
        addressStorage[MEDIATOR_CONTRACT] = _mediatorContract;
    }

    /**
    * @dev Stores the gas limit to be used in the message execution by the AMB bridge on the other network.
    * @param _requestGasLimit the gas limit for the message execution.
    */
    function _setRequestGasLimit(uint256 _requestGasLimit) internal {
        require(_requestGasLimit <= maxGasPerTx());
        uintStorage[REQUEST_GAS_LIMIT] = _requestGasLimit;
    }

    /**
    * @dev Tells the address that generated the message on the other network that is currently being executed by
    * the AMB bridge.
    * @return the address of the message sender.
    */
    function messageSender() internal view returns (address) {
        return bridgeContract().messageSender();
    }

    /**
    * @dev Tells the id of the message originated on the other network.
    * @return the id of the message originated on the other network.
    */
    function messageId() internal view returns (bytes32) {
        return bridgeContract().messageId();
    }

    /**
    * @dev Tells the maximum gas limit that a message can use on its execution by the AMB bridge on the other network.
    * @return the maximum gas limit value.
    */
    function maxGasPerTx() internal view returns (uint256) {
        return bridgeContract().maxGasPerTx();
    }
}
