pragma solidity 0.4.24;

import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import "../interfaces/IPot.sol";

interface IChai {
    function pot() external view returns (IPot);

    function daiToken() external view returns (ERC20);

    function balanceOf(address) external view returns (uint256);

    function dai(address) external view returns (uint256);

    function join(address, uint256) external;

    function draw(address, uint256) external;

    function exit(address, uint256) external;

    function transfer(address, uint256) external;
}
