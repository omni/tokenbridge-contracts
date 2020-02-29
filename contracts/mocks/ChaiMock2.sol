pragma solidity 0.4.24;

contract GemLike {
    function transfer(address, uint256) external returns (bool);
    function transferFrom(address, address, uint256) external returns (bool);
}

/**
 * @title ChaiMock2
 * @dev This contract is used for e2e tests only,
 * bridge contract requires non-empty chai stub with correct daiToken value and possibility to call join
 */
contract ChaiMock2 {
    GemLike public daiToken;
    uint256 internal daiBalance;
    address public pot;

    // wad is denominated in dai
    function join(address, uint256 wad) external {
        daiToken.transferFrom(msg.sender, address(this), wad);
        daiBalance += wad;
    }

    function exit(address, uint256 wad) external {
        daiToken.transfer(msg.sender, wad);
    }

    function dai(address) external view returns (uint256) {
        return daiBalance;
    }

    function balanceOf(address) external view returns (uint256) {
        return daiBalance;
    }
}
