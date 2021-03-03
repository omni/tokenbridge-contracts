pragma solidity 0.4.24;

import "../BasicBridge.sol";
import "./VersionableAMB.sol";

contract BasicAMB is BasicBridge, VersionableAMB {
    bytes32 internal constant MAX_GAS_PER_TX = 0x2670ecc91ec356e32067fd27b36614132d727b84a1e03e08f412a4f2cf075974; // keccak256(abi.encodePacked("maxGasPerTx"))
    bytes32 internal constant NONCE = 0x7ab1577440dd7bedf920cb6de2f9fc6bf7ba98c78c85a3fa1f8311aac95e1759; // keccak256(abi.encodePacked("nonce"))
    bytes32 internal constant SOURCE_CHAIN_ID = 0x67d6f42a1ed69c62022f2d160ddc6f2f0acd37ad1db0c24f4702d7d3343a4add; // keccak256(abi.encodePacked("sourceChainId"))
    bytes32 internal constant SOURCE_CHAIN_ID_LENGTH = 0xe504ae1fd6471eea80f18b8532a61a9bb91fba4f5b837f80a1cfb6752350af44; // keccak256(abi.encodePacked("sourceChainIdLength"))
    bytes32 internal constant DESTINATION_CHAIN_ID = 0xbbd454018e72a3f6c02bbd785bacc49e46292744f3f6761276723823aa332320; // keccak256(abi.encodePacked("destinationChainId"))
    bytes32 internal constant DESTINATION_CHAIN_ID_LENGTH = 0xfb792ae4ad11102b93f26a51b3749c2b3667f8b561566a4806d4989692811594; // keccak256(abi.encodePacked("destinationChainIdLength"))
    bytes32 internal constant ALLOW_REENTRANT_REQUESTS = 0xffa3a5a0e192028fc343362a39c5688e5a60819a4dc5ab3ee70c25bc25b78dd6; // keccak256(abi.encodePacked("allowReentrantRequests"))

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
        uint256 _sourceChainId,
        uint256 _destinationChainId,
        address _validatorContract,
        uint256 _maxGasPerTx,
        uint256 _gasPrice,
        uint256 _requiredBlockConfirmations,
        address _owner
    ) external onlyRelevantSender returns (bool) {
        require(!isInitialized());
        require(AddressUtils.isContract(_validatorContract));

        _setChainIds(_sourceChainId, _destinationChainId);
        addressStorage[VALIDATOR_CONTRACT] = _validatorContract;
        uintStorage[DEPLOYED_AT_BLOCK] = block.number;
        uintStorage[MAX_GAS_PER_TX] = _maxGasPerTx;
        _setGasPrice(_gasPrice);
        _setRequiredBlockConfirmations(_requiredBlockConfirmations);
        _setOwner(_owner);
        setInitialize();

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
     * Internal function for retrieving chain id for the source network
     * @return chain id for the current network
     */
    function sourceChainId() public view returns (uint256) {
        return uintStorage[SOURCE_CHAIN_ID];
    }

    /**
     * Internal function for retrieving chain id for the destination network
     * @return chain id for the destination network
     */
    function destinationChainId() public view returns (uint256) {
        return uintStorage[DESTINATION_CHAIN_ID];
    }

    /**
     * Updates chain ids of used networks
     * @param _sourceChainId chain id for current network
     * @param _destinationChainId chain id for opposite network
     */
    function setChainIds(uint256 _sourceChainId, uint256 _destinationChainId) external onlyOwner {
        _setChainIds(_sourceChainId, _destinationChainId);
    }

    /**
     * Sets the flag to allow passing new AMB requests in the opposite direction,
     * while other AMB message is being processed.
     * Only owner can call this method.
     * @param _enable true, if reentrant requests are allowed.
     */
    function setAllowReentrantRequests(bool _enable) external onlyOwner {
        boolStorage[ALLOW_REENTRANT_REQUESTS] = _enable;
    }

    /**
     * Tells if passing reentrant requests is allowed.
     * @return true, if reentrant requests are allowed.
     */
    function allowReentrantRequests() public view returns (bool) {
        return boolStorage[ALLOW_REENTRANT_REQUESTS];
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
    function _setChainIds(uint256 _sourceChainId, uint256 _destinationChainId) internal {
        require(_sourceChainId > 0 && _destinationChainId > 0);
        require(_sourceChainId != _destinationChainId);

        // Length fields are needed further when encoding the message.
        // Chain ids are compressed, so that leading zero bytes are not preserved.
        // In order to save some gas during calls to MessageDelivery.c,
        // lengths of chain ids are precalculated and being saved in the storage.
        uint256 sourceChainIdLength = 0;
        uint256 destinationChainIdLength = 0;
        uint256 mask = 0xff;

        for (uint256 i = 1; sourceChainIdLength == 0 || destinationChainIdLength == 0; i++) {
            if (sourceChainIdLength == 0 && _sourceChainId & mask == _sourceChainId) {
                sourceChainIdLength = i;
            }
            if (destinationChainIdLength == 0 && _destinationChainId & mask == _destinationChainId) {
                destinationChainIdLength = i;
            }
            mask = (mask << 8) | 0xff;
        }

        uintStorage[SOURCE_CHAIN_ID] = _sourceChainId;
        uintStorage[SOURCE_CHAIN_ID_LENGTH] = sourceChainIdLength;
        uintStorage[DESTINATION_CHAIN_ID] = _destinationChainId;
        uintStorage[DESTINATION_CHAIN_ID_LENGTH] = destinationChainIdLength;
    }

    /**
     * Internal function for retrieving chain id length for the source network
     * @return chain id for the current network
     */
    function _sourceChainIdLength() internal view returns (uint256) {
        return uintStorage[SOURCE_CHAIN_ID_LENGTH];
    }

    /**
     * Internal function for retrieving chain id length for the destination network
     * @return chain id for the destination network
     */
    function _destinationChainIdLength() internal view returns (uint256) {
        return uintStorage[DESTINATION_CHAIN_ID_LENGTH];
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
     * @param _chainId destination chain id of the received message
     */
    function _isDestinationChainIdValid(uint256 _chainId) internal returns (bool res) {
        return _chainId == sourceChainId();
    }
}
