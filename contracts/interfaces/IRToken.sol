pragma solidity 0.4.24;

/**
* @title IRToken
* @dev Interface of RToken (https://github.com/rtoken-project/rtoken-contracts)
*/
contract IRToken {
    function mint(uint256 mintAmount) external returns (bool);
    function redeem(uint256 redeemTokens) external returns (bool);
    function createHat(address[] recipients, uint32[] proportions, bool doChangeHat) external returns (uint256 hatID);
    function redeemAll() external returns (bool);
    function balanceOf(address owner) external view returns (uint256);
}
