pragma solidity 0.4.24;

contract GemLike {
    function mint(address, uint256) external returns (bool);
    function transferFrom(address, address, uint256) external returns (bool);
}

/**
 * @title ChaiMock2
 * @dev This contract is used for e2e tests only,
 * this mock represents a simplified version of Chai, which does not require other MakerDAO contracts to be deployed in e2e tests
 */
contract ChaiMock2 {
    event Transfer(address indexed src, address indexed dst, uint256 wad);

    GemLike public daiToken;
    uint256 internal daiBalance;
    address public pot;

    // wad is denominated in dai
    function join(address, uint256 wad) external {
        daiToken.transferFrom(msg.sender, address(this), wad);
        daiBalance += wad;
    }

    function transfer(address to, uint256 wad) external {
        require(daiBalance >= wad);
        daiBalance -= wad;
        emit Transfer(msg.sender, to, wad);
    }

    function exit(address, uint256 wad) external {
        require(daiBalance >= wad);
        daiBalance -= wad;
        daiToken.mint(msg.sender, wad);
    }

    function draw(address, uint256 wad) external {
        require(daiBalance >= wad);
        daiBalance -= wad;
        daiToken.mint(msg.sender, wad);
    }

    function dai(address) external view returns (uint256) {
        return daiBalance;
    }

    function balanceOf(address) external view returns (uint256) {
        return daiBalance;
    }
}
