pragma solidity 0.4.24;

import "../../upgradeability/Proxy.sol";

interface IPermittableTokenVersion {
    function version() external pure returns (string);
}

contract TokenProxy is Proxy {
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

    constructor(address _tokenImage, string memory _name, string memory _symbol, uint8 _decimals, uint256 _chainId)
        public
    {
        // same as
        // string memory version = IPermittableTokenVersion(_tokenImage).version();
        // but compiles without errors for spuriosDragon
        uint256 versionLen;
        IPermittableTokenVersion(_tokenImage).version();
        assembly {
            let tmp := mload(0x40)
            returndatacopy(tmp, 32, 32)
            versionLen := mload(tmp)
        }
        string memory version = new string(versionLen);
        assembly {
            returndatacopy(add(version, 32), 64, versionLen)

            // EIP 1967
            // bytes32(uint256(keccak256('eip1967.proxy.implementation')) - 1)
            sstore(0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc, _tokenImage)
        }
        name = _name;
        symbol = _symbol;
        decimals = _decimals;
        owner = msg.sender;
        bridgeContractAddr = msg.sender;
        DOMAIN_SEPARATOR = keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256(bytes(_name)),
                keccak256(bytes(version)),
                _chainId,
                address(this)
            )
        );
    }

    function implementation() public view returns (address impl) {
        assembly {
            impl := sload(0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc)
        }
    }
}
