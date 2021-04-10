pragma solidity 0.4.24;

interface IComptroller {
    function claimComp(address[] holders, address[] cTokens, bool borrowers, bool suppliers) external;
}
