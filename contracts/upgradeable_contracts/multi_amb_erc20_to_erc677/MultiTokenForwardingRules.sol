pragma solidity 0.4.24;

import "../../upgradeable_contracts/Ownable.sol";

/**
 * @title MultiTokenForwardingRules
 * @dev Multi token mediator functionality for managing destination AMB lanes permissions.
 */
contract MultiTokenForwardingRules is Ownable {
    address public constant ANY_ADDRESS = 0xFFfFfFffFFfffFFfFFfFFFFFffFFFffffFfFFFfF;

    event ForwardingRuleUpdated(address token, address sender, address receiver, int256 lane);

    /**
     * @dev Checks the destination lane for a particular bridge operation.
     * Makes a top-down checking of forwarding rules, from specific ones to more generic ones.
     * @param _token address of the token contract on the foreign side of the bridge.
     * @param _sender address of the tokens sender on the home side of the bridge.
     * @param _receiver address of the tokens receiver on the foreign side of the bridge.
     * @return destination lane identifier, where the message should be forwarded to.
     *  1 - oracle-driven-lane should be used.
     *  0 - default behaviour should be applied.
     * -1 - manual lane should be used.
     */
    function destinationLane(address _token, address _sender, address _receiver) public view returns (int256) {
        int256 lane = forwardingRule(_token, _sender, ANY_ADDRESS); // specific token for specific sender
        if (lane != 0) return lane;
        lane = forwardingRule(_token, ANY_ADDRESS, _receiver); // specific token for specific receiver
        if (lane != 0) return lane;
        lane = forwardingRule(ANY_ADDRESS, _sender, ANY_ADDRESS); // all tokens for specific sender
        if (lane != 0) return lane;
        lane = forwardingRule(ANY_ADDRESS, ANY_ADDRESS, _receiver); // all tokens for specific receiver
        if (lane != 0) return lane;
        return forwardingRule(_token, ANY_ADDRESS, ANY_ADDRESS); // specific token for all senders and receivers
    }

    /**
     * @dev Updates the preferred destination lane for the specific sender.
     * Only owner can call this method.
     * Examples:
     *   setForwardingRule(tokenA, ANY_ADDRESS, ANY_ADDRESS, -1) - forward all operations on tokenA to the manual lane
     *   setForwardingRule(tokenA, Alice, ANY_ADDRESS, 1) - allow Alice to use the oracle-driven lane for bridging tokenA
     *   setForwardingRule(tokenA, ANY_ADDRESS, Bob, 1) - forward all bridge operations, where Bob is the receiver, to the oracle-driven lane
     *   setForwardingRule(ANY_ADDRESS, Mallory, ANY_ADDRESS, -1) - forward all bridge operations from Mallory to the manual lane
     * @param _token address of the token contract on the foreign side of the bridge.
     * @param _sender address of the tokens sender on the home side of the bridge.
     * @param _receiver address of the tokens receiver on the foreign side of the bridge.
     * @param _lane preferred destination lane for the particular sender.
     *  1 - forward to the oracle-driven lane.
     *  0 - behaviour is unset, proceed by checking other less-specific rules.
     * -1 - manual lane should be used.
     */
    function setForwardingRule(address _token, address _sender, address _receiver, int256 _lane) external onlyOwner {
        require(_lane * _lane < 2);
        intStorage[keccak256(abi.encodePacked("forwardTo", _token, _sender, _receiver))] = _lane;

        emit ForwardingRuleUpdated(_token, _sender, _receiver, _lane);
    }

    /**
     * @dev Tells forwarding rule set up for a particular bridge operation.
     * @param _token address of the token contract on the foreign side of the bridge.
     * @param _sender address of the tokens sender on the home side of the bridge.
     * @param _receiver address of the tokens receiver on the foreign side of the bridge.
     * @return preferred destination lane for the particular bridge operation.
     */
    function forwardingRule(address _token, address _sender, address _receiver) public view returns (int256) {
        return intStorage[keccak256(abi.encodePacked("forwardTo", _token, _sender, _receiver))];
    }
}
