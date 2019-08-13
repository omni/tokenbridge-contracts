pragma solidity 0.4.24;

interface IAMBERC677UserRequest {
    function mintTokens(address _recipient, uint256 _value) external;
    function unlockTokens(address _recipient, uint256 _value) external;
}
