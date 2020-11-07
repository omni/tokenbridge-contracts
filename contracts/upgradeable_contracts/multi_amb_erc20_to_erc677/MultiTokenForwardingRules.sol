pragma solidity 0.4.24;

import "../../upgradeable_contracts/Ownable.sol";

/**
 * @title MultiTokenForwardingRules
 * @dev Multi token mediator functionality for managing destination AMB lanes permissions.
 */
contract MultiTokenForwardingRules is Ownable {
    address internal constant ANY_ADDRESS = 0xFFfFfFffFFfffFFfFFfFFFFFffFFFffffFfFFFfF;

    event ForwardingRuleUpdated(address token, address sender, address receiver, int256 lane);

    /**
     * @dev Tells the destination lane for a particular bridge operation by checking several wildcard forwarding rules.
     * @param _token address of the token contract on the foreign side of the bridge.
     * @param _sender address of the tokens sender on the home side of the bridge.
     * @param _receiver address of the tokens receiver on the foreign side of the bridge.
     * @return destination lane identifier, where the message should be forwarded to.
     *  1 - oracle-driven-lane should be used.
     *  0 - default behaviour should be applied.
     * -1 - manual lane should be used.
     */
    function destinationLane(address _token, address _sender, address _receiver) public view returns (int256) {
        int256 defaultLane = forwardingRule(_token, ANY_ADDRESS, ANY_ADDRESS); // specific token for all senders and receivers
        int256 lane;
        if (defaultLane < 0) {
            lane = forwardingRule(_token, _sender, ANY_ADDRESS); // specific token for specific sender
            if (lane != 0) return lane;
            lane = forwardingRule(_token, ANY_ADDRESS, _receiver); // specific token for specific receiver
            if (lane != 0) return lane;
            return defaultLane;
        }
        lane = forwardingRule(ANY_ADDRESS, _sender, ANY_ADDRESS); // all tokens for specific sender
        if (lane != 0) return lane;
        return forwardingRule(ANY_ADDRESS, ANY_ADDRESS, _receiver); // all tokens for specific receiver
    }

    /**
     * Updates the forwarding rule for bridging specific token.
     * Only owner can call this method.
     * @param _token address of the token contract on the foreign side.
     * @param _enable true, if bridge operations for a given token should be forwarded to the manual lane.
     */
    function setTokenForwardingRule(address _token, bool _enable) external {
        require(_token != ANY_ADDRESS);
        _setForwardingRule(_token, ANY_ADDRESS, ANY_ADDRESS, _enable ? int256(-1) : int256(0));
    }

    /**
     * Allows a particular address to send bridge requests to the oracle-driven lane for a particular token.
     * Only owner can call this method.
     * @param _token address of the token contract on the foreign side.
     * @param _sender address of the tokens sender on the home side of the bridge.
     * @param _enable true, if bridge operations for a given token and sender should be forwarded to the oracle-driven lane.
     */
    function setSenderExceptionForTokenForwardingRule(address _token, address _sender, bool _enable) external {
        require(_token != ANY_ADDRESS);
        require(_sender != ANY_ADDRESS);
        _setForwardingRule(_token, _sender, ANY_ADDRESS, _enable ? int256(1) : int256(0));
    }

    /**
     * Allows a particular address to receive bridged tokens from the oracle-driven lane for a particular token.
     * Only owner can call this method.
     * @param _token address of the token contract on the foreign side.
     * @param _receiver address of the tokens receiver on the foreign side of the bridge.
     * @param _enable true, if bridge operations for a given token and receiver should be forwarded to the oracle-driven lane.
     */
    function setReceiverExceptionForTokenForwardingRule(address _token, address _receiver, bool _enable) external {
        require(_token != ANY_ADDRESS);
        require(_receiver != ANY_ADDRESS);
        _setForwardingRule(_token, ANY_ADDRESS, _receiver, _enable ? int256(1) : int256(0));
    }

    /**
     * Updates the forwarding rule for the specific sender.
     * Only owner can call this method.
     * @param _sender address of the tokens sender on the home side.
     * @param _enable true, if all bridge operations from a given sender should be forwarded to the manual lane.
     */
    function setSenderForwardingRule(address _sender, bool _enable) external {
        require(_sender != ANY_ADDRESS);
        _setForwardingRule(ANY_ADDRESS, _sender, ANY_ADDRESS, _enable ? int256(-1) : int256(0));
    }

    /**
     * Updates the forwarding rule for the specific receiver.
     * Only owner can call this method.
     * @param _receiver address of the tokens receiver on the foreign side.
     * @param _enable true, if all bridge operations to a given receiver should be forwarded to the manual lane.
     */
    function setReceiverForwardingRule(address _receiver, bool _enable) external {
        require(_receiver != ANY_ADDRESS);
        _setForwardingRule(ANY_ADDRESS, ANY_ADDRESS, _receiver, _enable ? int256(-1) : int256(0));
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

    /**
     * @dev Internal function for updating the preferred destination lane for the specific wildcard pattern.
     * Only owner can call this method.
     * Examples:
     *   _setForwardingRule(tokenA, ANY_ADDRESS, ANY_ADDRESS, -1) - forward all operations on tokenA to the manual lane
     *   _setForwardingRule(tokenA, Alice, ANY_ADDRESS, 1) - allow Alice to use the oracle-driven lane for bridging tokenA
     *   _setForwardingRule(tokenA, ANY_ADDRESS, Bob, 1) - forward all tokenA bridge operations, where Bob is the receiver, to the oracle-driven lane
     *   _setForwardingRule(ANY_ADDRESS, Mallory, ANY_ADDRESS, -1) - forward all bridge operations from Mallory to the manual lane
     * @param _token address of the token contract on the foreign side of the bridge.
     * @param _sender address of the tokens sender on the home side of the bridge.
     * @param _receiver address of the tokens receiver on the foreign side of the bridge.
     * @param _lane preferred destination lane for the particular sender.
     *  1 - forward to the oracle-driven lane.
     *  0 - behaviour is unset, proceed by checking other less-specific rules.
     * -1 - manual lane should be used.
     */
    function _setForwardingRule(address _token, address _sender, address _receiver, int256 _lane) internal onlyOwner {
        intStorage[keccak256(abi.encodePacked("forwardTo", _token, _sender, _receiver))] = _lane;

        emit ForwardingRuleUpdated(_token, _sender, _receiver, _lane);
    }
}
