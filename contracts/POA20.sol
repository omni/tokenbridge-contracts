pragma solidity 0.4.19;
import "zeppelin-solidity/contracts/token/ERC827/ERC827Token.sol";
import "zeppelin-solidity/contracts/token/ERC20/PausableToken.sol";
import "zeppelin-solidity/contracts/token/ERC20/BurnableToken.sol";
import "zeppelin-solidity/contracts/token/ERC20/MintableToken.sol";
import "zeppelin-solidity/contracts/token/ERC20/DetailedERC20.sol";
import "./IBurnableMintableERC827Token.sol";


contract POA20 is IBurnableMintableERC827Token, DetailedERC20, BurnableToken, MintableToken, PausableToken, ERC827Token {
    function POA20(string _name, string _symbol, uint8 _decimals) public DetailedERC20(_name, _symbol, _decimals) {
    }
    /**
     * @dev Burns a specific amount of tokens.
     * @param _value The amount of token to be burned.
     **/

    function burn(uint256 _value) public onlyOwner {
      super.burn(_value);
    }
}