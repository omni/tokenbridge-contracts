pragma solidity 0.4.24;

import "../BasicBridge.sol";
import "./VersionableAMB.sol";

contract BasicAMB is BasicBridge, VersionableAMB {
    bytes32 internal constant MAX_GAS_PER_TX = 0x2670ecc91ec356e32067fd27b36614132d727b84a1e03e08f412a4f2cf075974; // keccak256(abi.encodePacked("maxGasPerTx"))
    bytes32 internal constant NONCE = 0x7ab1577440dd7bedf920cb6de2f9fc6bf7ba98c78c85a3fa1f8311aac95e1759; // keccak256(abi.encodePacked("nonce"))
    bytes32 internal constant SOURCE_CHAIN_ID = 0x67d6f42a1ed69c62022f2d160ddc6f2f0acd37ad1db0c24f4702d7d3343a4add; // keccak256(abi.encodePacked("sourceChainId"))
    bytes32 internal constant DESTINATION_CHAIN_ID = 0xbbd454018e72a3f6c02bbd785bacc49e46292744f3f6761276723823aa332320; // keccak256(abi.encodePacked("destinationChainId"))

    /**
     * Initializes AMB contract
     * @param _sourceChainId chain id of a network where this contract is deployed
     * @param _destinationChainId chain id of a network where all outgoing messages are directed
     * @param _validatorContract address of the validators contract
     * @param _maxGasPerTx maximum amount of gas per one message execution
     * @param _gasPrice default gas price used by oracles for sending transactions in this network
     * @param _requiredBlockConfirmations number of block confirmations oracle will wait before processing passed messages
     * @param _owner address of new bridge owner
     */
    function initialize(
        bytes _sourceChainId,
        bytes _destinationChainId,
        address _validatorContract,
        uint256 _maxGasPerTx,
        uint256 _gasPrice,
        uint256 _requiredBlockConfirmations,
        address _owner
    ) external onlyRelevantSender returns (bool) {
        require(!isInitialized());
        require(AddressUtils.isContract(_validatorContract));
        require(_gasPrice > 0);
        require(_requiredBlockConfirmations > 0);

        _setChainIds(_sourceChainId, _destinationChainId);
        addressStorage[VALIDATOR_CONTRACT] = _validatorContract;
        uintStorage[DEPLOYED_AT_BLOCK] = block.number;
        uintStorage[MAX_GAS_PER_TX] = _maxGasPerTx;
        uintStorage[GAS_PRICE] = _gasPrice;
        uintStorage[REQUIRED_BLOCK_CONFIRMATIONS] = _requiredBlockConfirmations;
        setOwner(_owner);
        setInitialize();

        emit RequiredBlockConfirmationChanged(_requiredBlockConfirmations);
        emit GasPriceChanged(_gasPrice);

        return isInitialized();
    }

    function getBridgeMode() external pure returns (bytes4 _data) {
        return 0x2544fbb9; // bytes4(keccak256(abi.encodePacked("arbitrary-message-bridge-core")))
    }

    function maxGasPerTx() public view returns (uint256) {
        return uintStorage[MAX_GAS_PER_TX];
    }

    function setMaxGasPerTx(uint256 _maxGasPerTx) external onlyOwner {
        uintStorage[MAX_GAS_PER_TX] = _maxGasPerTx;
    }

    /**
     * Updating chain ids of used networks
     * @param _sourceChainId chain id for current network
     * @param _destinationChainId chain id for opposite network
     */
    function setChainIds(bytes _sourceChainId, bytes _destinationChainId) external onlyOwner {
        _setChainIds(_sourceChainId, _destinationChainId);
    }

    /**
     * Internal function for retrieving current nonce value
     * @return nonce value
     */
    function _nonce() internal view returns (uint64) {
        return uint64(uintStorage[NONCE]);
    }

    /**
     * Internal function for updating nonce value
     * @param _nonce new nonce value
     */
    function _setNonce(uint64 _nonce) internal {
        uintStorage[NONCE] = uint256(_nonce);
    }

    /**
     * Internal function for updating chain ids of used networks
     * @param _sourceChainId chain id for current network
     * @param _destinationChainId chain id for opposite network
     */
    function _setChainIds(bytes memory _sourceChainId, bytes memory _destinationChainId) internal {
        require(
            _sourceChainId.length > 0 &&
                _destinationChainId.length > 0 &&
                _sourceChainId.length <= 32 &&
                _destinationChainId.length <= 32 &&
                _sourceChainId[0] > 0 &&
                _destinationChainId[0] > 0 &&
                keccak256(_destinationChainId) != keccak256(_sourceChainId)
        );
        bytesStorage[SOURCE_CHAIN_ID] = _sourceChainId;
        bytesStorage[DESTINATION_CHAIN_ID] = _destinationChainId;
    }

    /**
     * Internal function for retrieving chain id for the source network
     * @return chain id for the current network
     */
    function _sourceChainId() internal view returns (bytes memory) {
        return bytesStorage[SOURCE_CHAIN_ID];
    }

    /**
     * Internal function for retrieving chain id for the destination network
     * @return chain id for the destination network
     */
    function _destinationChainId() internal view returns (bytes memory) {
        return bytesStorage[DESTINATION_CHAIN_ID];
    }

    /**
     * Internal function for validating version of the received message
     * @param _messageId id of the received message
     */
    function _isMessageVersionValid(bytes32 _messageId) internal returns (bool) {
        return
            _messageId & 0xffffffff00000000000000000000000000000000000000000000000000000000 == MESSAGE_PACKING_VERSION;
    }

    /**
     * Internal function for validating destination chain id of the received message
     * @param _chainId destination chain id of the received message, left-aligned
     */
    function _isDestinationChainIdValid(uint256 _chainId) internal returns (bool res) {
        bytes memory sourceChainId = _sourceChainId();
        assembly {
            // chainId, shifted to the right
            let shiftedChainId := mload(add(sourceChainId, 32))
            // bit shift, 256 bits - chainIdLength * 8 bits
            let shift := sub(256, shl(3, mload(sourceChainId)))
            res := eq(_chainId, shr(shift, shiftedChainId))
        }
    }
}
