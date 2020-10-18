pragma solidity 0.4.24;

import "./PermittableToken.sol";

/**
 * @title ERC677MultiBridgeToken
 * @dev This contract extends ERC677BridgeToken to support several bridge simulteniously
 */
contract ERC677MultiBridgeToken is PermittableToken {
    uint256 internal constant MAX_BRIDGES = 50;
    address[] internal bridges;

    event BridgeAdded(address indexed bridge);
    event BridgeRemoved(address indexed bridge);

    constructor(string _name, string _symbol, uint8 _decimals, uint256 _chainId)
        public
        PermittableToken(_name, _symbol, _decimals, _chainId)
    {
        // solhint-disable-previous-line no-empty-blocks
    }

    /**
    * @dev Removes unused function from ERC677BridgeToken contract
    */
    function setBridgeContract(address) external {
        revert();
    }

    /**
    * @dev Removes unused getter from ERC677BridgeToken contract
    */
    function bridgeContract() external view returns (address) {
        revert();
    }

    /**
    * @dev Adds one more bridge contract into the list
    * @param _bridge bridge contract address
    */
    function addBridge(address _bridge) external onlyOwner {
        require(bridges.length < MAX_BRIDGES);
        require(AddressUtils.isContract(_bridge));
        require(!isBridge(_bridge));

        bridges.push(_bridge);

        emit BridgeAdded(_bridge);
    }

    /**
    * @dev Removes one existing bridge contract from the list
    * @param _bridge bridge contract address
    */
    function removeBridge(address _bridge) external onlyOwner {
        uint256 count = bridges.length;
        for (uint256 i = 0; i < count; i++) {
            if (bridges[i] == _bridge) {
                if (i < count - 1) {
                    bridges[i] = bridges[count - 1];
                }
                delete bridges[count - 1];
                bridges.length--;
                emit BridgeRemoved(_bridge);
                return;
            }
        }
        // If bridge is not found and nothing was removed, the transactions is reverted
        revert();
    }

    /**
     * @dev Returns the number of registered bridges.
     * @return number of registered bridges.
     */
    function bridgeCount() external view returns (uint256) {
        return bridges.length;
    }

    /**
    * @dev Returns all recorded bridge contract addresses
    * @return address[] bridge contract addresses
    */
    function bridgeList() external view returns (address[]) {
        return bridges;
    }

    /**
    * @dev Checks if given address is included into bridge contracts list
    * @param _address bridge contract address
    * @return bool true, if given address is a known bridge contract 
    */
    function isBridge(address _address) public view returns (bool) {
        for (uint256 i = 0; i < bridges.length; i++) {
            if (bridges[i] == _address) {
                return true;
            }
        }
        return false;
    }
}
