pragma solidity 0.4.24;

import "openzeppelin-solidity/contracts/AddressUtils.sol";
import "../../../Ownable.sol";
import "./MultiTokenForwardingRulesManager.sol";

/**
 * @title MultiTokenForwardingRulesConnector
 * @dev Connectivity functionality that is required for using forwarding rules manager.
 */
contract MultiTokenForwardingRulesConnector is Ownable {
    bytes32 internal constant FORWARDING_RULES_MANAGER_CONTRACT = 0x5f86f226cd489cc09187d5f5e0adfb94308af0d4ceac482dd8a8adea9d80daf4; // keccak256(abi.encodePacked("forwardingRulesManagerContract"))

    /**
    * @dev Updates an address of the used forwarding rules manager contract.
    * @param _manager address of forwarding rules manager contract.
    */
    function setForwardingRulesManager(address _manager) external onlyOwner {
        require(_manager == address(0) || AddressUtils.isContract(_manager));
        addressStorage[FORWARDING_RULES_MANAGER_CONTRACT] = _manager;
    }

    /**
    * @dev Retrieves an address of the forwarding rules manager contract.
    * @return address of the forwarding rules manager contract.
    */
    function forwardingRulesManager() public view returns (MultiTokenForwardingRulesManager) {
        return MultiTokenForwardingRulesManager(addressStorage[FORWARDING_RULES_MANAGER_CONTRACT]);
    }

    /**
     * @dev Checks if bridge operation is allowed to use oracle driven lane.
     * @param _token address of the token contract on the foreign side of the bridge.
     * @param _sender address of the tokens sender on the home side of the bridge.
     * @param _receiver address of the tokens receiver on the foreign side of the bridge.
     * @return true, if message can be forwarded to the oracle-driven lane.
     */
    function _isOracleDrivenLaneAllowed(address _token, address _sender, address _receiver) internal returns (bool) {
        MultiTokenForwardingRulesManager manager = forwardingRulesManager();
        return address(manager) == address(0) || manager.destinationLane(_token, _sender, _receiver) >= 0;
    }
}
