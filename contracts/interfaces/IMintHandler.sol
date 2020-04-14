pragma solidity 0.4.24;

interface IMintHandler {
    function mint(address _to, uint256 _amount) external returns (bool);
}
