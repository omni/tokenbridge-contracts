pragma solidity 0.4.24;

interface IScdMcdMigration {
    function swapSaiToDai(uint256 wad) external;
    function daiJoin() external returns (address);
}

interface IDaiAdapter {
    function dai() public returns (address);
}

interface ISaiTop {
    function caged() public returns (uint256);
}
