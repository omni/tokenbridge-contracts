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

    modifier onlyBridgeContract {
        require(_isBridgeContract(msg.sender));
        _;
    }

    modifier onlySystem {
        require(msg.sender == address(0));
        _;
    }

    function bridgesAllowed() public view returns (address[bridgesAllowedLength]) {
        // These values must be changed before deploy
        return [address(0x0000000000000000000000000000000000000000)];
    }

    function blockRewardContractId() public pure returns (bytes4) {
        return bytes4(keccak256("blockReward"));
    }

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

    function reward(address[] benefactors, uint16[] kind) external onlySystem returns (address[], uint256[]) {
        require(benefactors.length == 0);
        require(kind.length == 0);

        uint256 extraLength = extraReceiversLength();

        address[] memory receivers = new address[](extraLength);
        uint256[] memory rewards = new uint256[](extraLength);

        uint256 i;

        for (i = 0; i < extraLength; i++) {
            address extraAddress = extraReceiverByIndex(i);
            uint256 extraAmount = extraReceiverAmount(extraAddress);
            _setExtraReceiverAmount(0, extraAddress);
            receivers[i] = extraAddress;
            rewards[i] = extraAmount;
        }

        for (i = 0; i < extraLength; i++) {
            _setMinted(rewards[i], receivers[i]);
        }

        for (i = 0; i < bridgesAllowedLength; i++) {
            address bridgeAddress = bridgesAllowed()[i];
            uint256 bridgeAmountForBlock = bridgeAmount(bridgeAddress);

            if (bridgeAmountForBlock > 0) {
                _setBridgeAmount(0, bridgeAddress);
                _addMintedTotallyByBridge(bridgeAmountForBlock, bridgeAddress);
            }
        }

        _clearExtraReceivers();

        return (receivers, rewards);
    }

    function bridgeAmount(address _bridge) public view returns (uint256) {
        return uintStorage[keccak256(abi.encodePacked(BRIDGE_AMOUNT, _bridge))];
    }

    function extraReceiverByIndex(uint256 _index) public view returns (address) {
        return addressStorage[keccak256(abi.encodePacked(EXTRA_RECEIVER_ADDRESS, _index))];
    }

    function extraReceiverAmount(address _receiver) public view returns (uint256) {
        return uintStorage[keccak256(abi.encodePacked(EXTRA_RECEIVER_AMOUNT, _receiver))];
    }

    function extraReceiversLength() public view returns (uint256) {
        return uintStorage[EXTRA_RECEIVERS_LENGTH];
    }

    function mintedForAccount(address _account) public view returns (uint256) {
        return uintStorage[keccak256(abi.encodePacked(MINTED_FOR_ACCOUNT, _account))];
    }

    function mintedForAccountInBlock(address _account, uint256 _blockNumber) public view returns (uint256) {
        return uintStorage[keccak256(abi.encodePacked(MINTED_FOR_ACCOUNT_IN_BLOCK, _account, _blockNumber))];
    }

    function mintedInBlock(uint256 _blockNumber) public view returns (uint256) {
        return uintStorage[keccak256(abi.encodePacked(MINTED_IN_BLOCK, _blockNumber))];
    }

    function mintedTotally() public view returns (uint256) {
        return uintStorage[MINTED_TOTALLY];
    }

    function mintedTotallyByBridge(address _bridge) public view returns (uint256) {
        return uintStorage[keccak256(abi.encodePacked(MINTED_TOTALLY_BY_BRIDGE, _bridge))];
    }

    function _addExtraReceiver(address _receiver) private {
        uint256 _index = extraReceiversLength();
        addressStorage[keccak256(abi.encodePacked(EXTRA_RECEIVER_ADDRESS, _index))] = _receiver;
        uintStorage[EXTRA_RECEIVERS_LENGTH] = _index + 1;
    }

    function _addMintedTotallyByBridge(uint256 _amount, address _bridge) private {
        bytes32 hash = keccak256(abi.encodePacked(MINTED_TOTALLY_BY_BRIDGE, _bridge));
        uintStorage[hash] = uintStorage[hash].add(_amount);
    }

    function _setBridgeAmount(uint256 _amount, address _bridge) private {
        uintStorage[keccak256(abi.encodePacked(BRIDGE_AMOUNT, _bridge))] = _amount;
    }

    function _clearExtraReceivers() private {
        uintStorage[EXTRA_RECEIVERS_LENGTH] = 0;
    }

    function _isBridgeContract(address _addr) private view returns (bool) {
        address[bridgesAllowedLength] memory bridges = bridgesAllowed();

        for (uint256 i = 0; i < bridges.length; i++) {
            if (_addr == bridges[i]) {
                return true;
            }
        }

        return false;
    }

    function _setExtraReceiverAmount(uint256 _amount, address _receiver) private {
        uintStorage[keccak256(abi.encodePacked(EXTRA_RECEIVER_AMOUNT, _receiver))] = _amount;
    }

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
