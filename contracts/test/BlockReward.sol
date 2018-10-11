pragma solidity 0.4.24;

import "../IBlockReward.sol";
import "../libraries/SafeMath.sol";


contract BlockReward is IBlockReward {
    using SafeMath for uint256;

    uint256 public mintedCoins = 0;
    mapping(bytes32 => uint256) internal uintStorage;
    bytes32 internal constant MINTED_TOTALLY_BY_BRIDGE = "mintedTotallyByBridge";
    uint256 public constant bridgesAllowedLength = 3;

    function () external payable {
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

    function mintedTotallyByBridge(address _bridge) public view returns(uint256) {
        return uintStorage[
        keccak256(abi.encode(MINTED_TOTALLY_BY_BRIDGE, _bridge))
        ];
    }

    function addMintedTotallyByBridge(uint256 _amount, address _bridge) external {
        bytes32 hash = keccak256(abi.encode(MINTED_TOTALLY_BY_BRIDGE, _bridge));
        uintStorage[hash] = uintStorage[hash].add(_amount);
    }

    function bridgesAllowed() public pure returns(address[bridgesAllowedLength]) {
        return([
            0x0cDEE95B0Ed18FccEB4c344Df4dd1C1642798a8b,
            0x320051BbD4eeE344Bb86F0A858d03595837463eF,
            0xce42bdB34189a93c55De250E011c68FaeE374Dd3
        ]);
    }
}
