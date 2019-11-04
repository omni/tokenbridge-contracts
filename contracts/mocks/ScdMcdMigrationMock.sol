pragma solidity 0.4.24;

import "../interfaces/IScdMcdMigration.sol";
import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import "openzeppelin-solidity/contracts/token/ERC20/MintableToken.sol";

contract ScdMcdMigrationMock is IScdMcdMigration {
    address public sai;
    IDaiAdapter public daiJoin;

    constructor(address _sai, address _daiJoin) public {
        sai = _sai;
        daiJoin = IDaiAdapter(_daiJoin);
    }

    function swapSaiToDai(uint256 wad) external {
        ERC20(sai).transferFrom(msg.sender, address(this), wad);
        MintableToken(daiJoin.dai()).mint(msg.sender, wad);
    }

    function daiJoin() external returns (address) {
        return daiJoin;
    }
}
