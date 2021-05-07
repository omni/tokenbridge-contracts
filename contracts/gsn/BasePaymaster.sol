// SPDX-License-Identifier:MIT
pragma solidity 0.4.24;
pragma experimental ABIEncoderV2;

import "../upgradeable_contracts/Ownable.sol";

import "./interfaces/GsnTypes.sol";
import "./interfaces/IPaymaster.sol";
import "./interfaces/IRelayHub.sol";
import "./utils/GsnEip712Library.sol";
import "./forwarder/IForwarder.sol";

/**
 * Abstract base class to be inherited by a concrete Paymaster
 * A subclass must implement:
 *  - preRelayedCall
 *  - postRelayedCall
 */
contract BasePaymaster is IPaymaster, Ownable {
    IRelayHub internal relayHub;
    IForwarder public trustedForwarder;

    function getHubAddr() public view returns (address) {
        return address(relayHub);
    }

    //overhead of forwarder verify+signature, plus hub overhead.
    uint256 public constant FORWARDER_HUB_OVERHEAD = 50000;

    //These parameters are documented in IPaymaster.GasLimits
    uint256 public constant PRE_RELAYED_CALL_GAS_LIMIT = 100000;
    uint256 public constant POST_RELAYED_CALL_GAS_LIMIT = 110000;
    uint256 public constant PAYMASTER_ACCEPTANCE_BUDGET = PRE_RELAYED_CALL_GAS_LIMIT + FORWARDER_HUB_OVERHEAD;

    function getGasLimits() external view returns (IPaymaster.GasLimits) {
        return
            IPaymaster.GasLimits(PAYMASTER_ACCEPTANCE_BUDGET, PRE_RELAYED_CALL_GAS_LIMIT, POST_RELAYED_CALL_GAS_LIMIT);
    }

    // this method must be called from preRelayedCall to validate that the forwarder
    // is approved by the paymaster as well as by the recipient contract.
    function _verifyForwarder(GsnTypes.RelayRequest relayRequest) public view {
        require(address(trustedForwarder) == relayRequest.relayData.forwarder, "Forwarder is not trusted");
        GsnEip712Library.verifyForwarderTrusted(relayRequest);
    }

    /*
     * modifier to be used by recipients as access control protection for preRelayedCall & postRelayedCall
     */
    modifier relayHubOnly() {
        require(msg.sender == getHubAddr(), "Function can only be called by RelayHub");
        _;
    }

    function setRelayHub(IRelayHub hub) public onlyOwner {
        relayHub = hub;
    }

    function setTrustedForwarder(IForwarder forwarder) public onlyOwner {
        trustedForwarder = forwarder;
    }

    // check current deposit on relay hub.
    function getRelayHubDeposit() public view returns (uint256) {
        return relayHub.balanceOf(address(this));
    }

    // withdraw deposit from relayHub
    function withdrawRelayHubDepositTo(uint256 amount, address target) public onlyOwner {
        relayHub.withdraw(amount, target);
    }
}
