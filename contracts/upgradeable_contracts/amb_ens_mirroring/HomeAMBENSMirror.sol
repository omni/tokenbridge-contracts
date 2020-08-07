pragma solidity 0.4.24;

import "../../interfaces/IENS.sol";
import "./BasicAMBENSMirror.sol";
import "./ENSBridgeRegistry.sol";

/**
* @title HomeAMBENSMirror
* @dev Home mediator functionality for mirroring existing ENS records intended to work on top of AMB bridge.
*/
contract HomeAMBENSMirror is BasicAMBENSMirror, ENSBridgeRegistry {
    /**
    * @dev Stores the initial parameters of the mediator.
    * @param _bridgeContract the address of the AMB bridge contract.
    * @param _mediatorContract the address of the mediator contract on the other network.
    * @param _owner address of the owner of the mediator contract.
    * @param _resolverContract address of public resolver contract.
    */
    function initialize(address _bridgeContract, address _mediatorContract, address _owner, address _resolverContract)
        external
        onlyRelevantSender
        returns (bool)
    {
        require(!isInitialized());
        require(_owner != address(0));
        require(AddressUtils.isContract(_resolverContract));

        _setBridgeContract(_bridgeContract);
        _setMediatorContractOnOtherSide(_mediatorContract);
        setOwner(_owner);
        addressStorage[ENS_DEFAULT_RESOLVER] = _resolverContract;

        setInitialize();
        return isInitialized();
    }

    /**
    * @dev Updates mirrored ENS record parameters came from other side.
    * Can only be called by mediator on the other side.
    * @param _node ENS record namehash identifier.
    * @param _owner ENS record owner address.
    * @param _addr ENS record associated address.
    * @param _ttl ENS record time-to-live parameter.
    */
    function updateENSNode(bytes32 _node, address _owner, address _addr, uint64 _ttl) external onlyMediator {
        // node associated address will be only updated when new node is bridged
        // for subsequent updates, address should be updated manually using setAddr
        if (!recordExists(_node)) {
            address _resolver = addressStorage[ENS_DEFAULT_RESOLVER];
            _setOwner(_node, address(this));
            _setResolver(_node, _resolver);
            _setTTL(_node, _ttl);
            IENSAddrResolver(_resolver).setAddr(_node, _addr);
        }

        _setOwner(_node, _owner);

        emit BridgeENSNode(_node, _owner);
    }
}
