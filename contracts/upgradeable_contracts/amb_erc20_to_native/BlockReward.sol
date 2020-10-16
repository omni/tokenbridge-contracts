pragma solidity ^0.4.24;

import "../../upgradeability/EternalStorage.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";

contract BlockReward is EternalStorage {
    using SafeMath for uint256;

    bytes32 internal constant MINTED_TOTALLY = 0x076e79ca1c3a46f0c7d1e9e7f14bcb9716bfc49eed37baf510328301a7109c25; // keccak256(abi.encodePacked("mintedTotally"))
    bytes32 internal constant EXTRA_RECEIVERS_LENGTH = 0x0678259008a66390de8a5ac3f500d1dfb0d0f57018441e2cc69aaa0f52c97d44; // keccak256(abi.encodePacked("extraReceiversLength"))
    bytes32 internal constant EXTRA_RECEIVER_ADDRESS = 0xa47da669ec9f3749fbb12db00588b5fa6b5bbd24da81eb6cab44261334c21c17; // keccak256(abi.encodePacked("extraReceiverAddress"))
    bytes32 internal constant EXTRA_RECEIVER_AMOUNT = 0x0f09dbb26898a3af738d25c5fff308337ac8f2b0acbbaf209b373fb1389bcf2f; // keccak256(abi.encodePacked("extraReceiverAmount"))
    bytes32 internal constant BRIDGE_AMOUNT = 0xa7f48dc57b1a051b1732e5ed136bbfd33bb5aa418e3e3498901320529e785461; // keccak256(abi.encodePacked("bridgeAmount"))
    bytes32 internal constant MINTED_FOR_ACCOUNT = 0x0fd3be07b1332be84678873bf53feb10604cd09244fb4bb9154e03e00709b9e7; // keccak256(abi.encodePacked("mintedForAccount"))
    bytes32 internal constant MINTED_FOR_ACCOUNT_IN_BLOCK = 0x24ae442c1f305c4f1294bf2dddd491a64250b2818b446706e9a74aeaaaf6f419; // keccak256(abi.encodePacked("mintedForAccountInBlock"))
    bytes32 internal constant MINTED_IN_BLOCK = 0x3840e646f7ce9b3210f5440e2dbd6b36451169bfdac65ef00a161729eded81bd; // keccak256(abi.encodePacked("mintedInBlock"))
    bytes32 internal constant MINTED_TOTALLY_BY_BRIDGE = 0x12e71282a577e2b463da2c18bc96b6122db29bcef9065ed5a7f0f9316c11c08e; // keccak256(abi.encodePacked("mintedTotallyByBridge"))

    // solhint-disable const-name-snakecase
    uint256 public constant bridgesAllowedLength = 1;
    // solhint-enable const-name-snakecase

    event AddedReceiver(uint256 amount, address indexed receiver, address indexed bridge);

    /**
    * @dev Throws if sender is not in the list of allowed bridge contracts.
    */
    modifier onlyBridgeContract {
        require(_isBridgeContract(msg.sender));
        _;
    }

    /**
    * @dev Throws if sender is not account reserved for the system operations.
    */
    modifier onlySystem {
        require(msg.sender == address(0));
        _;
    }

    /**
    * @dev Return the allowed bridge addresses.
    * @return List of bridge contracts addresses.
    */
    function bridgesAllowed() public view returns (address[bridgesAllowedLength]) {
        // These values must be changed before deploy
        return [address(0x0000000000000000000000000000000000000000)];
    }

    /**
    * @dev Verifies that this contract is indeed a block reward contract, by returning a 4-byte contract identifier.
    * @return 4-byte identifier.
    */
    function blockRewardContractId() public pure returns (bytes4) {
        return bytes4(keccak256("blockReward"));
    }

    /**
    * @dev Add a receiver for the minted native tokens.
    * Can be called on by a valid bridge contract, that is whitelisted in the contract.
    * @param _amount amount of native coins to mint for the receiver.
    * @param _receiver address of a recipient account, to which coins should be minted.
    */
    function addExtraReceiver(uint256 _amount, address _receiver) external onlyBridgeContract {
        require(_amount != 0);
        require(_receiver != address(0));
        uint256 oldAmount = extraReceiverAmount(_receiver);
        if (oldAmount == 0) {
            _addExtraReceiver(_receiver);
        }
        _setExtraReceiverAmount(oldAmount.add(_amount), _receiver);
        _setBridgeAmount(bridgeAmount(msg.sender).add(_amount), msg.sender);
        emit AddedReceiver(_amount, _receiver, msg.sender);
    }

    /**
    * @dev Special method that is called by the system, in order to get accounts and values for minting new coins in upcoming block.
    * Can be called only by a system-reserved address.
    * @param benefactors list of block reward receivers, should be empty.
    * @param kind list of reward types for addresses in benefactors list, should be empty.
    * @return tuple of addresses list and values list of the same length that describes where and how much new coins should be minted.
    */
    function reward(address[] benefactors, uint16[] kind) external onlySystem returns (address[], uint256[]) {
        // As these contracts were intended to work on top of the forked Quorum client,
        // the arguments of this function will depend on the particular client code.
        // For simplicity, and since Quorum does not have any block rewards,
        // it was decided to keep argument arrays empty.
        // However, in the original OpenEthereum blockReward implementation,
        // first argument should contain some reward receiver addresses (i.e. miner of a block, uncle blocks miners, etc.),
        // second argument describes the reward types of the benefactors.
        require(benefactors.length == 0);
        require(kind.length == 0);

        uint256 extraLength = extraReceiversLength();

        // Lists with extra receivers and their rewards. Extra receivers are generated by the bridge/mediator contracts,
        // and they are not passed in the benefactors array.
        address[] memory receivers = new address[](extraLength);
        uint256[] memory rewards = new uint256[](extraLength);

        uint256 i;

        uint256 sumOfRewards = 0;
        uint256 sumOfBridgeAmounts = 0;

        for (i = 0; i < extraLength; i++) {
            address extraAddress = extraReceiverByIndex(i);
            uint256 extraAmount = extraReceiverAmount(extraAddress);
            _setExtraReceiverAmount(0, extraAddress);
            receivers[i] = extraAddress;
            rewards[i] = extraAmount;
            _setMinted(extraAmount, extraAddress);
            sumOfRewards += extraAmount;
        }

        for (i = 0; i < bridgesAllowedLength; i++) {
            address bridgeAddress = bridgesAllowed()[i];
            uint256 bridgeAmountForBlock = bridgeAmount(bridgeAddress);

            if (bridgeAmountForBlock > 0) {
                _setBridgeAmount(0, bridgeAddress);
                _addMintedTotallyByBridge(bridgeAmountForBlock, bridgeAddress);
                sumOfBridgeAmounts += bridgeAmountForBlock;
            }
        }

        require(sumOfRewards == sumOfBridgeAmounts);

        _clearExtraReceivers();

        return (receivers, rewards);
    }

    /**
    * @dev Shows pending mint amount, requested by a particular bridge address that hasn't been yet processed by the call to reward().
    * @param _bridge address of the bridge contract.
    * @return pending amount of minted tokens.
    */
    function bridgeAmount(address _bridge) public view returns (uint256) {
        return uintStorage[keccak256(abi.encodePacked(BRIDGE_AMOUNT, _bridge))];
    }

    /**
    * @dev Retrieves extra receiver address by its index from the extra receivers list.
    * @param _index index of receiver in the list, should be less than extraReceiversLength().
    * @return address of the receiver.
    */
    function extraReceiverByIndex(uint256 _index) public view returns (address) {
        return addressStorage[keccak256(abi.encodePacked(EXTRA_RECEIVER_ADDRESS, _index))];
    }

    /**
    * @dev Retrieves accumulated amount of requested minted value for the particular receiver address.
    * @param _receiver address of the receiver.
    * @return total amount of requested mint operations in the current block.
    */
    function extraReceiverAmount(address _receiver) public view returns (uint256) {
        return uintStorage[keccak256(abi.encodePacked(EXTRA_RECEIVER_AMOUNT, _receiver))];
    }

    /**
    * @dev Retrieves a number of registered extra receivers in the pending block.
    * @return length of the extra receivers list.
    */
    function extraReceiversLength() public view returns (uint256) {
        return uintStorage[EXTRA_RECEIVERS_LENGTH];
    }

    /**
    * @dev Retrieves the total minted amount for the given address for the whole chain lifetime.
    * @param _account address of the receiver.
    * @return total amount of requested mint operations for the given user for all blocks.
    */
    function mintedForAccount(address _account) public view returns (uint256) {
        return uintStorage[keccak256(abi.encodePacked(MINTED_FOR_ACCOUNT, _account))];
    }

    /**
    * @dev Retrieves the total minted amount for the given address in the particular block.
    * @param _account address of the receiver.
    * @param _blockNumber particular block number.
    * @return total amount of requested mint operations for given user in the given block.
    */
    function mintedForAccountInBlock(address _account, uint256 _blockNumber) public view returns (uint256) {
        return uintStorage[keccak256(abi.encodePacked(MINTED_FOR_ACCOUNT_IN_BLOCK, _account, _blockNumber))];
    }

    /**
    * @dev Retrieves the total minted amount in the given block.
    * @param _blockNumber particular block number.
    * @return total amount of requested mint operations in the specific block.
    */
    function mintedInBlock(uint256 _blockNumber) public view returns (uint256) {
        return uintStorage[keccak256(abi.encodePacked(MINTED_IN_BLOCK, _blockNumber))];
    }

    /**
    * @dev Retrieves the total minted amount for all users for all blocks.
    * @return total amount of requested mint operations in this block reward contract.
    */
    function mintedTotally() public view returns (uint256) {
        return uintStorage[MINTED_TOTALLY];
    }

    /**
    * @dev Retrieves the total minted amount for all users for all blocks for the particular bridge.
    * @param _bridge address of the bridge contract.
    * @return total amount of requested mint operations in this block reward contract associated with the given bridge address.
    */
    function mintedTotallyByBridge(address _bridge) public view returns (uint256) {
        return uintStorage[keccak256(abi.encodePacked(MINTED_TOTALLY_BY_BRIDGE, _bridge))];
    }

    /**
    * @dev Internal function for adding extra receiver in the list.
    * New receiver is added to the end of the list.
    * @param _receiver address of the receiver.
    */
    function _addExtraReceiver(address _receiver) private {
        uint256 _index = extraReceiversLength();
        addressStorage[keccak256(abi.encodePacked(EXTRA_RECEIVER_ADDRESS, _index))] = _receiver;
        uintStorage[EXTRA_RECEIVERS_LENGTH] = _index + 1;
    }

    /**
    * @dev Internal function for adding minted value for some particular bridge contract.
    * @param _amount minted amount.
    * @param _bridge address of the bridge contract.
    */
    function _addMintedTotallyByBridge(uint256 _amount, address _bridge) private {
        bytes32 hash = keccak256(abi.encodePacked(MINTED_TOTALLY_BY_BRIDGE, _bridge));
        uintStorage[hash] = uintStorage[hash].add(_amount);
    }

    /**
    * @dev Internal function for updating pending bridge amount requested for minting for some particular bridge contract.
    * @param _amount new minted amount.
    * @param _bridge address of the bridge contract.
    */
    function _setBridgeAmount(uint256 _amount, address _bridge) private {
        uintStorage[keccak256(abi.encodePacked(BRIDGE_AMOUNT, _bridge))] = _amount;
    }

    /**
    * @dev Internal function clearing extra receivers list. It is done by setting receivers list length to 0.
    */
    function _clearExtraReceivers() private {
        uintStorage[EXTRA_RECEIVERS_LENGTH] = 0;
    }

    /**
    * @dev Checks if the given address is whitelisted.
    * @param _addr address of the bridge to check.
    * @return true, if given address is associated with one of the registered bridges.
    */
    function _isBridgeContract(address _addr) private view returns (bool) {
        address[bridgesAllowedLength] memory bridges = bridgesAllowed();

        for (uint256 i = 0; i < bridges.length; i++) {
            if (_addr == bridges[i]) {
                return true;
            }
        }

        return false;
    }

    /**
    * @dev Internal function for updating pending min amount for minting for some particular user.
    * @param _amount new minted amount.
    * @param _receiver address of the bridge receiver.
    */
    function _setExtraReceiverAmount(uint256 _amount, address _receiver) private {
        uintStorage[keccak256(abi.encodePacked(EXTRA_RECEIVER_AMOUNT, _receiver))] = _amount;
    }

    /**
    * @dev Internal function for updating different mint statistics.
    * @param _amount new minted amount.
    * @param _account address of the receiver.
    */
    function _setMinted(uint256 _amount, address _account) private {
        bytes32 hash = keccak256(abi.encodePacked(MINTED_FOR_ACCOUNT_IN_BLOCK, _account, block.number));
        uintStorage[hash] = _amount;

        hash = keccak256(abi.encodePacked(MINTED_FOR_ACCOUNT, _account));
        uintStorage[hash] = uintStorage[hash].add(_amount);

        hash = keccak256(abi.encodePacked(MINTED_IN_BLOCK, block.number));
        uintStorage[hash] = uintStorage[hash].add(_amount);

        uintStorage[MINTED_TOTALLY] = uintStorage[MINTED_TOTALLY].add(_amount);
    }
}
