// SPDX-License-Identifier:MIT
pragma solidity 0.4.24;
pragma experimental ABIEncoderV2;

import "../upgradeable_contracts/Ownable.sol";

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
    address private _trustedForwarder;

    function getHubAddr() public view returns (address) {
        return address(relayHub);
    }

    //overhead of forwarder verify+signature, plus hub overhead.
    uint256 public constant FORWARDER_HUB_OVERHEAD = 50000;

    //These parameters are documented in IPaymaster.GasAndDataLimits
    uint256 public constant PRE_RELAYED_CALL_GAS_LIMIT = 100000;
    uint256 public constant POST_RELAYED_CALL_GAS_LIMIT = 110000;
    uint256 public constant PAYMASTER_ACCEPTANCE_BUDGET = PRE_RELAYED_CALL_GAS_LIMIT + FORWARDER_HUB_OVERHEAD;
    uint256 public constant CALLDATA_SIZE_LIMIT = 10500;

    function getGasAndDataLimits() external view returns (IPaymaster.GasAndDataLimits limits) {
        return
            IPaymaster.GasAndDataLimits(
                PAYMASTER_ACCEPTANCE_BUDGET,
                PRE_RELAYED_CALL_GAS_LIMIT,
                POST_RELAYED_CALL_GAS_LIMIT,
                CALLDATA_SIZE_LIMIT
            );
    }

    // this method must be called from preRelayedCall to validate that the forwarder
    // is approved by the paymaster as well as by the recipient contract.
    function _verifyForwarder(GsnTypes.RelayRequest relayRequest) public view {
        require(address(_trustedForwarder) == relayRequest.relayData.forwarder, "Forwarder is not trusted");
        GsnEip712Library.verifyForwarderTrusted(relayRequest);
    }

    /*
     * modifier to be used by recipients as access control protection for preRelayedCall & postRelayedCall
     */
    modifier relayHubOnly() {
        require(msg.sender == getHubAddr(), "can only be called by RelayHub");
        _;
    }

    function setRelayHub(IRelayHub hub) public onlyOwner {
        relayHub = hub;
    }

    function setTrustedForwarder(address forwarder) public onlyOwner {
        _trustedForwarder = forwarder;
    }

    function trustedForwarder() external view returns (address) {
        return _trustedForwarder;
    }

    /// check current deposit on relay hub.
    function getRelayHubDeposit() external view returns (uint256) {
        return relayHub.balanceOf(address(this));
    }

    // any eth moved into the paymaster is transferred as a deposit.
    // This way, we don't need to understand the RelayHub API in order to replenish
    // the paymaster.
    function() external payable {
        require(address(relayHub) != address(0), "relay hub address not set");
        relayHub.depositFor.value(msg.value)(address(this));
    }

    /// withdraw deposit from relayHub
    function withdrawRelayHubDepositTo(uint256 amount, address target) public onlyOwner {
        relayHub.withdraw(amount, target);
    }
}
