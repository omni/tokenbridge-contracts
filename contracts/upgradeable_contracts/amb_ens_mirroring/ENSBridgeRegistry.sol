pragma solidity 0.4.24;

import "../../interfaces/IENS.sol";
import "../../upgradeability/EternalStorage.sol";
import "openzeppelin-solidity/contracts/AddressUtils.sol";

/**
 * @title ENSBridgeRegistry
 * @dev The ENS registry contract intended to work as a part of the Home ENS mediator.
 */
contract ENSBridgeRegistry is IENS, EternalStorage {
    bytes32 internal constant ENS_DEFAULT_RESOLVER = 0xc2b77c5d2423030ffea534cdaba0e27c8f03374d963a21220c21e226d43586da; // keccak256(abi.encodePacked("ensDefaultResolver"))

    // Permits modifications only by the owner of the specified node.
    modifier authorised(bytes32 _node) {
        address _owner = owner(_node);
        require(_owner == msg.sender || isApprovedForAll(_owner, msg.sender));
        _;
    }

    /**
     * @dev Sets the resolver address for the specified node.
     * @param _node The node to update.
     * @param _resolver The address of the resolver.
     */
    function setResolver(bytes32 _node, address _resolver) external authorised(_node) {
        _setResolver(_node, _resolver);
    }

    /**
     * @dev Sets the TTL for the specified node.
     * @param _node The node to update.
     * @param _ttl The TTL in seconds.
     */
    function setTTL(bytes32 _node, uint64 _ttl) external authorised(_node) {
        _setTTL(_node, _ttl);
    }

    /**
     * @dev Enable or disable approval for a third party ("operator") to manage
     *  all of `msg.sender`'s ENS records. Emits the ApprovalForAll event.
     * @param _operator Address to add to the set of authorized operators.
     * @param _approved True if the operator is approved, false to revoke approval.
     */
    function setApprovalForAll(address _operator, bool _approved) external {
        boolStorage[keccak256(abi.encodePacked("ensApproved", msg.sender, _operator))] = _approved;
        emit ApprovalForAll(msg.sender, _operator, _approved);
    }

    /**
     * @dev Returns the address that owns the specified node.
     * @param _node The specified node.
     * @return address of the owner.
     */
    function owner(bytes32 _node) public view returns (address) {
        return addressStorage[keccak256(abi.encodePacked("ensOwner", _node))];
    }

    /**
     * @dev Returns the address of the resolver for the specified node.
     * @param _node The specified node.
     * @return address of the resolver.
     */
    function resolver(bytes32 _node) public view returns (address) {
        return addressStorage[keccak256(abi.encodePacked("ensResolver", _node))];
    }

    /**
     * @dev Returns the TTL of a node, and any records associated with it.
     * @param _node The specified node.
     * @return ttl of the node.
     */
    function ttl(bytes32 _node) external view returns (uint64) {
        return uint64(uintStorage[keccak256(abi.encodePacked("ensTTL", _node))]);
    }

    /**
     * @dev Returns whether a record has been imported to the registry.
     * @param _node The specified node.
     * @return Bool if record exists
     */
    function recordExists(bytes32 _node) public view returns (bool) {
        return owner(_node) != address(0x0);
    }

    /**
     * @dev Query if an address is an authorized operator for another address.
     * @param _owner The address that owns the records.
     * @param _operator The address that acts on behalf of the owner.
     * @return True if `operator` is an approved operator for `owner`, false otherwise.
     */
    function isApprovedForAll(address _owner, address _operator) public view returns (bool) {
        return boolStorage[keccak256(abi.encodePacked("ensApproved", _owner, _operator))];
    }

    /**
     * @dev Internal function for transferring ownership of a node to a new address.
     * @param _node The node to transfer ownership of.
     * @param _owner The address of the new owner.
     */
    function _setOwner(bytes32 _node, address _owner) internal {
        addressStorage[keccak256(abi.encodePacked("ensOwner", _node))] = _owner;
        emit Transfer(_node, _owner);
    }

    /**
     * @dev Internal function for setting the resolver address for the specified node.
     * @param _node The node to update.
     * @param _resolver The address of the resolver.
     */
    function _setResolver(bytes32 _node, address _resolver) internal {
        require(AddressUtils.isContract(_resolver) || _resolver == address(0));
        addressStorage[keccak256(abi.encodePacked("ensResolver", _node))] = _resolver;
        emit NewResolver(_node, _resolver);
    }

    /**
     * @dev Internal function for setting the TTL for the specified node.
     * @param _node The node to update.
     * @param _ttl The TTL in seconds.
     */
    function _setTTL(bytes32 _node, uint64 _ttl) internal {
        uintStorage[keccak256(abi.encodePacked("ensTTL", _node))] = uint256(_ttl);
        emit NewTTL(_node, _ttl);
    }
}
