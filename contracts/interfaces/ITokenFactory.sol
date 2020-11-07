pragma solidity 0.4.24;

interface ITokenFactory {
    function deployToken(address _originalToken, string _name, string _symbol, uint8 _decimals)
        external
        returns (address);
}
