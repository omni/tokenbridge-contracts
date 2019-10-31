pragma solidity 0.4.24;

import "../interfaces/IScdMcdMigration.sol";
import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import "openzeppelin-solidity/contracts/token/ERC20/MintableToken.sol";

contract ScdMcdMigrationMock is IScdMcdMigration {
    address public sai;
    address public dai;

    constructor(address _sai, address _dai) public {
        sai = _sai;
        dai = _dai;
    }

    function swapSaiToDai(uint256 wad) external {
        ERC20(sai).transferFrom(msg.sender, address(this), wad);
        MintableToken(dai).mint(msg.sender, wad);
    }
}
