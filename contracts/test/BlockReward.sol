pragma solidity 0.4.24;

import "../IBlockReward.sol";
import "../libraries/SafeMath.sol";


contract BlockReward is IBlockReward {
    using SafeMath for uint256;

    uint256 public totalMintedCoins = 0;

    function () external payable {
    }

    function addExtraReceiver(uint256 _amount, address _receiver) external {
        require(_amount > 0);
        require(_receiver != address(0));
        totalMintedCoins = totalMintedCoins.add(_amount);
        _receiver.transfer(_amount);
    }
}
