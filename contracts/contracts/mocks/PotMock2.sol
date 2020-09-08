pragma solidity 0.4.24;

contract GemLike {
    function transfer(address, uint256) external returns (bool);

    function transferFrom(
        address,
        address,
        uint256
    ) external returns (bool);
}

/**
 * @title PotMock2
 * @dev This contract is used for e2e tests only
 */
contract PotMock2 {
    // solhint-disable const-name-snakecase
    uint256 public constant dsr = 10**27; // the Dai Savings Rate
    uint256 public constant chi = 10**27; // the Rate Accumulator
    uint256 public constant rho = 10**27; // time of last drip

    // solhint-enable const-name-snakecase

    function drip() external returns (uint256) {
        return chi;
    }
}
