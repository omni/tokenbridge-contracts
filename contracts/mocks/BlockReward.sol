pragma solidity 0.4.24;

import "../interfaces/IBlockReward.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";

contract BlockReward {
    using SafeMath for uint256;

    address[] public validatorList;
    uint256 public mintedCoins = 0;
    uint256 public feeAmount = 0;
    mapping(bytes32 => uint256) internal uintStorage;
    bytes32 internal constant MINTED_TOTALLY_BY_BRIDGE = "mintedTotallyByBridge";
    bytes4 internal constant MINT_REWARD = 0xe2f764a3; // mintReward(address[],uint256[])
    address public token;

    function() external payable {
        // solhint-disable-previous-line no-empty-blocks
    }

    function addExtraReceiver(uint256 _amount, address _receiver) external {
        require(_amount > 0);
        require(_receiver != address(0));
        mintedCoins = mintedCoins.add(_amount);
        this.addMintedTotallyByBridge(_amount, msg.sender);
        _receiver.transfer(_amount);
    }

    function mintedTotally() public view returns (uint256) {
        return mintedCoins;
    }

    function mintedTotallyByBridge(address _bridge) public view returns (uint256) {
        return uintStorage[keccak256(abi.encode(MINTED_TOTALLY_BY_BRIDGE, _bridge))];
    }

    function addMintedTotallyByBridge(uint256 _amount, address _bridge) external {
        bytes32 hash = keccak256(abi.encode(MINTED_TOTALLY_BY_BRIDGE, _bridge));
        uintStorage[hash] = uintStorage[hash].add(_amount);
    }

    function setValidatorsRewards(address[] _initialValidators) external {
        validatorList = _initialValidators;
    }

    function setToken(address _token) external {
        token = _token;
    }

    function addBridgeNativeFeeReceivers(uint256 _amount) external {
        feeAmount = _amount;
        uint256 feePerValidator = _amount.div(validatorList.length);

        uint256 randomValidatorIndex;
        uint256 diff = _amount.sub(feePerValidator.mul(validatorList.length));
        if (diff > 0) {
            randomValidatorIndex = random(validatorList.length);
        }

        for (uint256 i = 0; i < validatorList.length; i++) {
            uint256 feeToDistribute = feePerValidator;
            if (diff > 0 && randomValidatorIndex == i) {
                feeToDistribute = feeToDistribute.add(diff);
            }
            this.addExtraReceiver(feeToDistribute, validatorList[i]);
        }
    }

    function addBridgeTokenFeeReceivers(uint256 _amount) external {
        address[] memory receivers = new address[](validatorList.length);
        uint256[] memory rewards = new uint256[](validatorList.length);
        feeAmount = _amount;
        uint256 feePerValidator = _amount.div(validatorList.length);

        uint256 randomValidatorIndex;
        uint256 diff = _amount.sub(feePerValidator.mul(validatorList.length));
        if (diff > 0) {
            randomValidatorIndex = random(validatorList.length);
        }

        for (uint256 i = 0; i < validatorList.length; i++) {
            uint256 feeToDistribute = feePerValidator;
            if (diff > 0 && randomValidatorIndex == i) {
                feeToDistribute = feeToDistribute.add(diff);
            }
            receivers[i] = validatorList[i];
            rewards[i] = feeToDistribute;
        }

        require(token.call(abi.encodeWithSelector(MINT_REWARD, receivers, rewards)));
    }

    function random(uint256 _count) public view returns (uint256) {
        return uint256(blockhash(block.number.sub(1))) % _count;
    }

    function blockRewardContractId() public pure returns (bytes4) {
        return bytes4(keccak256("blockReward"));
    }
}
