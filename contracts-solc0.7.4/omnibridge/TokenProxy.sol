pragma solidity 0.7.4;

interface IPermittableTokenVersion {
    function version() external pure returns (string memory);
}

/**
* @title TokenProxy
* @dev Helps to reduces the size of the deployed bytecode for automatically created tokens, by using a proxy contract.
*/
contract TokenProxy {
    // storage layout is copied from PermittableToken.sol
    string internal name;
    string internal symbol;
    uint8 internal decimals;
    mapping(address => uint256) internal balances;
    uint256 internal totalSupply;
    mapping(address => mapping(address => uint256)) internal allowed;
    address internal owner;
    bool internal mintingFinished;
    address internal bridgeContractAddr;
    // string public constant version = "1";
    bytes32 internal DOMAIN_SEPARATOR;
    // bytes32 public constant PERMIT_TYPEHASH = 0xea2aa0a1be11a07ed86d755c93467f4f82362b452371d1ba94d1715123511acb;
    mapping(address => uint256) internal nonces;
    mapping(address => mapping(address => uint256)) internal expirations;

    /**
    * @dev Creates a non-upgradeable token proxy for PermittableToken.sol, initializes its eternalStorage.
    * @param _tokenImage address of the token image used for mirroring all functions.
    * @param _name token name.
    * @param _symbol token symbol.
    * @param _decimals token decimals.
    * @param _owner owner of the newly created token contract.
    */
    constructor(address _tokenImage, string memory _name, string memory _symbol, uint8 _decimals, address _owner) {
        string memory version = IPermittableTokenVersion(_tokenImage).version();

        uint256 id;
        assembly {
            id := chainid()
        // EIP 1967
        // bytes32(uint256(keccak256('eip1967.proxy.implementation')) - 1)
            sstore(0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc, _tokenImage)
        }
        name = _name;
        symbol = _symbol;
        decimals = _decimals;
        owner = _owner; // _owner == HomeMultiAMBErc20ToErc677 mediator
        bridgeContractAddr = _owner;
        DOMAIN_SEPARATOR = keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256(bytes(_name)),
                keccak256(bytes(version)),
                id,
                address(this)
            )
        );
    }

    fallback() external payable {
        assembly {
            let impl := sload(0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc)
            let ptr := mload(0x40)

            calldatacopy(ptr, 0, calldatasize())

            let result := delegatecall(gas(), impl, ptr, calldatasize(), 0, 0)
            returndatacopy(ptr, 0, returndatasize())

            switch result
                case 0 {
                    revert(ptr, returndatasize())
                }
                default {
                    return(ptr, returndatasize())
                }
        }
    }

    /**
    * @dev Retrieves the implementation contract address, mirrored token image.
    * @return impl token image address.
    */
    function implementation() public view returns (address impl) {
        assembly {
            impl := sload(0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc)
        }
    }
}
