pragma solidity 0.4.24;

import "../../upgradeable_contracts/Ownable.sol";

contract MultiTokenLanePermissions is Ownable {
    uint256 internal constant TOKEN_DESTINATION_LANE_TAG = 0;
    uint256 internal constant SENDER_DESTINATION_LANE_TAG = 1;
    uint256 internal constant RECEIVER_DESTINATION_LANE_TAG = 2;

    /**
     * @dev Checks the oracle driven lane permissions for a particular bridge operation.
     * @param _token address of the token contract on the foreign side of the bridge.
     * @param _sender address of the tokens sender on the home side of the bridge.
     * @param _receiver address of the tokens receiver on the foreign side of the bridge.
     * @return true, if oracle driven lane should be used for the operation.
     */
    function oracleDrivenLaneAllowed(address _token, address _sender, address _receiver) public view returns (bool) {
        int256 senderLane = _destinationLane(SENDER_DESTINATION_LANE_TAG, _sender);
        if (senderLane > 0) {
            return true;
        }
        int256 receiverLane = _destinationLane(RECEIVER_DESTINATION_LANE_TAG, _receiver);
        if (receiverLane > 0) {
            return true;
        }
        if (senderLane < 0 || receiverLane < 0) {
            return false;
        }
        return _destinationLane(TOKEN_DESTINATION_LANE_TAG, _token) >= 0;
    }

    /**
     * @dev Updates the preferred destination lane for the specific sender.
     * Only owner can call this method.
     * @param _addr address of the tokens sender on the home side of the bridge.
     * @param _lane preferred destination lane for the particular sender.
     */
    function setSenderDestinationLane(address _addr, int256 _lane) external onlyOwner {
        _setDestinationLane(SENDER_DESTINATION_LANE_TAG, _addr, _lane);
    }

    /**
     * @dev Updates the preferred destination lane for the specific receiver.
     * Only owner can call this method.
     * @param _addr address of the tokens receiver on the foreign side of the bridge.
     * @param _lane preferred destination lane for the particular receiver.
     */
    function setReceiverDestinationLane(address _addr, int256 _lane) external onlyOwner {
        _setDestinationLane(RECEIVER_DESTINATION_LANE_TAG, _addr, _lane);
    }

    /**
     * @dev Updates the preferred destination lane for the specific token contract.
     * Only owner can call this method.
     * @param _token address of the token contract on the foreign side of the bridge.
     * @param _lane preferred destination lane for the particular token contract.
     */
    function setTokenDestinationLane(address _token, int256 _lane) external onlyOwner {
        _setDestinationLane(TOKEN_DESTINATION_LANE_TAG, _token, _lane);
    }

    /**
     * @dev Tells the preferred destination lane for the specific sender.
     * @param _addr address of the tokens sender on the home side of the bridge.
     * @return preferred destination lane for the particular sender.
     */
    function senderDestinationLane(address _addr) public view returns (int256) {
        return _destinationLane(SENDER_DESTINATION_LANE_TAG, _addr);
    }

    /**
     * @dev Tells the preferred destination lane for the specific receiver.
     * @param _addr address of the tokens receiver on the foreign side of the bridge.
     * @return preferred destination lane for the particular receiver.
     */
    function receiverDestinationLane(address _addr) public view returns (int256) {
        return _destinationLane(RECEIVER_DESTINATION_LANE_TAG, _addr);
    }

    /**
     * @dev Tells the preferred destination lane for the specific token contract.
     * @param _token address of the token contract on the foreign side of the bridge.
     * @return preferred destination lane for the particular token contract.
     */
    function tokenDestinationLane(address _token) public view returns (int256) {
        return _destinationLane(TOKEN_DESTINATION_LANE_TAG, _token);
    }

    /**
     * @dev Internal function for updating the preferred destination lane rule.
     * @param _tag identifier of the restriction/allowance rule.
     * @param _addr address for which rule is updated.
     * @param _lane destination lane identifier
     *  1 - oracle driven lane is preferred
     *  0 - rule is unset
     * -1 - manual lane is preferred
     */
    function _setDestinationLane(uint256 _tag, address _addr, int256 _lane) internal {
        require(_lane * _lane < 2);
        intStorage[keccak256(abi.encodePacked("destinationLane", _tag, _addr))] = _lane;
    }

    /**
     * @dev Internal function for retrieving the preferred destination lane for the particular tag and address.
     * @param _tag destination lane rule tag.
     * @param _addr address for which destination lane should be checked.
     * @return preferred destination lane.
     */
    function _destinationLane(uint256 _tag, address _addr) internal view returns (int256) {
        return intStorage[keccak256(abi.encodePacked("destinationLane", _tag, _addr))];
    }
}
