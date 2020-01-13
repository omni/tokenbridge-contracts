pragma solidity 0.4.24;

import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";

/**
* @title IRToken
* @dev Interface of RToken (https://github.com/rtoken-project/rtoken-contracts)
*/
contract IRToken is ERC20 {
    function mint(uint256 mintAmount) external returns (bool);
    function redeem(uint256 redeemTokens) external returns (bool);
    function createHat(address[] recipients, uint32[] proportions, bool doChangeHat) external returns (uint256 hatID);
    function redeemAll() external returns (bool);
    function token() public returns (ERC20);
}
