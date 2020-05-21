pragma solidity 0.4.24;

import "../BasicBridge.sol";
import "./VersionableAMB.sol";

contract BasicAMB is BasicBridge, VersionableAMB {
    bytes32 internal constant MAX_GAS_PER_TX = 0x2670ecc91ec356e32067fd27b36614132d727b84a1e03e08f412a4f2cf075974; // keccak256(abi.encodePacked("maxGasPerTx"))
    bytes32 internal constant NONCE = 0x7ab1577440dd7bedf920cb6de2f9fc6bf7ba98c78c85a3fa1f8311aac95e1759; // keccak256(abi.encodePacked("nonce"))
    bytes32 internal constant CHAIN_ID = 0x8ed9144e2f2122812934305f889c544efe55db33a5fd4b235aaab787c3f913d4; // keccak256(abi.encodePacked("chainId"))

    /**
     * Initializes AMB contract
     * @param _chainId chain id of a network where this contract is deployed
     * @param _validatorContract address of the validators contract
     * @param _maxGasPerTx maximum amount of gas per one message execution
     * @param _gasPrice default gas price used by oracles for sending transactions in this network
     * @param _requiredBlockConfirmations number of block confirmations oracle will wait before processing passed messages
     * @param _owner address of new bridge owner
     */
    function initialize(
        uint256 _chainId,
        address _validatorContract,
        uint256 _maxGasPerTx,
        uint256 _gasPrice,
        uint256 _requiredBlockConfirmations,
        address _owner
    ) external onlyRelevantSender returns (bool) {
        require(!isInitialized());
        require(_chainId > 0);
        require(AddressUtils.isContract(_validatorContract));
        require(_gasPrice > 0);
        require(_requiredBlockConfirmations > 0);

        uintStorage[CHAIN_ID] = _chainId;
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
     * Updates chain id value
     * @param chainId chain id for current network
     */
    function setChainId(uint256 chainId) external onlyOwner {
        require(chainId > 0);
        uintStorage[CHAIN_ID] = chainId;
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
     * Internal function for retrieving used chain id
     * @return chain id for current network
     */
    function _chainId() internal view returns (uint256) {
        return uintStorage[CHAIN_ID];
    }

    /**
     * Internal function for validating id of the received message
     * @param _messageId id of the received message
     */
    function _validateMessageId(bytes32 _messageId) internal {
        require(
            _messageId & 0xffffffff00000000000000000000000000000000000000000000000000000000 == MESSAGE_PACKING_VERSION
        );
    }
}
