pragma solidity 0.4.24;

import "./PermittableToken.sol";

/**
 * @title ERC677MultiBridgeToken
 * @dev This contract extends ERC677BridgeToken to support several bridge simulteniously
 */
contract ERC677MultiBridgeToken is PermittableToken {
    address public constant F_ADDR = 0xFFfFfFffFFfffFFfFFfFFFFFffFFFffffFfFFFfF;
    uint256 internal constant MAX_BRIDGES = 50;
    mapping(address => address) public bridgePointers;
    uint256 public bridgeCount;

    event BridgeAdded(address indexed bridge);
    event BridgeRemoved(address indexed bridge);

    constructor(string _name, string _symbol, uint8 _decimals, uint256 _chainId)
        public
        PermittableToken(_name, _symbol, _decimals, _chainId)
    {
        bridgePointers[F_ADDR] = F_ADDR; // empty bridge contracts list
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
        require(bridgeCount < MAX_BRIDGES);
        require(AddressUtils.isContract(_bridge));
        require(!isBridge(_bridge));

        address firstBridge = bridgePointers[F_ADDR];
        require(firstBridge != address(0));
        bridgePointers[F_ADDR] = _bridge;
        bridgePointers[_bridge] = firstBridge;
        bridgeCount = bridgeCount.add(1);

        emit BridgeAdded(_bridge);
    }

    /**
    * @dev Removes one existing bridge contract from the list
    * @param _bridge bridge contract address
    */
    function removeBridge(address _bridge) external onlyOwner {
        require(isBridge(_bridge));

        address nextBridge = bridgePointers[_bridge];
        address index = F_ADDR;
        address next = bridgePointers[index];
        require(next != address(0));

        while (next != _bridge) {
            index = next;
            next = bridgePointers[index];

            require(next != F_ADDR && next != address(0));
        }

        bridgePointers[index] = nextBridge;
        delete bridgePointers[_bridge];
        bridgeCount = bridgeCount.sub(1);

        emit BridgeRemoved(_bridge);
    }

    /**
    * @dev Returns all recorded bridge contract addresses
    * @return address[] bridge contract addresses
    */
    function bridgeList() external view returns (address[]) {
        address[] memory list = new address[](bridgeCount);
        uint256 counter = 0;
        address nextBridge = bridgePointers[F_ADDR];
        require(nextBridge != address(0));

        while (nextBridge != F_ADDR) {
            list[counter] = nextBridge;
            nextBridge = bridgePointers[nextBridge];
            counter++;

            require(nextBridge != address(0));
        }

        return list;
    }

    /**
    * @dev Checks if given address is included into bridge contracts list
    * @param _address bridge contract address
    * @return bool true, if given address is a known bridge contract 
    */
    function isBridge(address _address) public view returns (bool) {
        return _address != F_ADDR && bridgePointers[_address] != address(0);
    }
}
