pragma solidity 0.4.24;

import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";

contract ITriPool {
    function add_liquidity(uint256[3] amounts, uint256 minMintAmount) external;

    function remove_liquidity_imbalance(uint256[3] amounts, uint256 maxBurnAmount) external;

    function calc_token_amount(uint256[3] amounts, bool isDeposit) external view returns (uint256);

    function calc_withdraw_one_coin(uint256 lpAmount, int128 index) external view returns (uint256);

    function exchange(int128 fromIndex, int128 toIndex, uint256 amount, uint256 minReceived) external;
}
