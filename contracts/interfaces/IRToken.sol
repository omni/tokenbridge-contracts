pragma solidity 0.4.24;

contract IRToken {
    function mint(uint256 mintAmount) external returns (bool);
    function redeem(uint256 redeemTokens) external returns (bool);
    function createHat(address[] recipients, uint32[] proportions, bool doChangeHat) external returns (uint256 hatID);
}
