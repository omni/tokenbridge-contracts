pragma solidity 0.4.24;

import "../../interfaces/IENS.sol";
import "./BasicAMBENSMirror.sol";
import "./HomeAMBENSMirror.sol";
import "openzeppelin-solidity/contracts/AddressUtils.sol";

/**
* @title ForeignAMBENSMirror
* @dev Foreign mediator functionality for mirroring existing ENS records intended to work on top of AMB bridge.
*/
contract ForeignAMBENSMirror is BasicAMBENSMirror {
    bytes32 internal constant ENS_REGISTRY = 0xbf73a8f25960de5ebfb3a8385bf0b70b6598db027255cebc160e88c4507ca172; // keccak256(abi.encodePacked("ensRegistry"))

    /**
    * @dev Stores the initial parameters of the mediator.
    * @param _bridgeContract the address of the AMB bridge contract.
    * @param _mediatorContract the address of the mediator contract on the other network.
    * @param _requestGasLimit the gas limit for the message execution.
    * @param _owner address of the owner of the mediator contract.
    * @param _ensRegistry address of the ens registry contract.
    */
    function initialize(
        address _bridgeContract,
        address _mediatorContract,
        uint256 _requestGasLimit,
        address _owner,
        address _ensRegistry
    ) external onlyRelevantSender returns (bool) {
        require(!isInitialized());
        require(_owner != address(0));
        require(AddressUtils.isContract(_ensRegistry));

        _setBridgeContract(_bridgeContract);
        _setMediatorContractOnOtherSide(_mediatorContract);
        _setRequestGasLimit(_requestGasLimit);
        setOwner(_owner);
        addressStorage[ENS_REGISTRY] = _ensRegistry;

        setInitialize();
        return isInitialized();
    }

    /**
    * @dev Retrieves the address of the associated ENS registry contract, from where all records should mirrored.
    * @return address of the ENS registry contract.
    */
    function ensRegistry() public view returns (IENS) {
        return IENS(addressStorage[ENS_REGISTRY]);
    }

    /**
    * @dev Performes an AMB request for updating the ENS record on the other side.
    * @param _node ENS record namehash identifier.
    */
    function bridgeENSNode(bytes32 _node) external {
        address owner = ensRegistry().owner(_node);
        require(owner != address(0));
        uint64 ttl = ensRegistry().ttl(_node);

        IENSAddrResolver resolver = IENSAddrResolver(ensRegistry().resolver(_node));
        address addr;
        if (address(resolver) != address(0)) {
            addr = resolver.addr(_node);
        }

        bytes memory data = abi.encodeWithSelector(
            HomeAMBENSMirror(address(this)).updateENSNode.selector,
            _node,
            owner,
            addr,
            ttl
        );

        bridgeContract().requireToPassMessage(mediatorContractOnOtherSide(), data, requestGasLimit());

        emit BridgeENSNode(_node, owner);
    }
}
