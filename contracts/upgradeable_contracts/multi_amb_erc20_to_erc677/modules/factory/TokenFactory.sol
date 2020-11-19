pragma solidity 0.4.24;

import "./TokenProxy.sol";
import "../OwnableModule.sol";

/**
 * @title TokenFactory
 * @dev Factory contract for deployment of new TokenProxy contracts.
 */
contract TokenFactory is OwnableModule {
    address public tokenImage;

    /**
     * @dev Initializes this contract
     * @param _owner of this factory contract.
     * @param _tokenImage address of the token image contract that should be used for creation of new tokens.
     */
    constructor(address _owner, address _tokenImage) public OwnableModule(_owner) {
        tokenImage = _tokenImage;
    }

    /**
     * @dev Updates the address of the used token image contract.
     * Only owner can call this method.
     * @param _tokenImage address of the new token image used for further deployments.
     */
    function setTokenImage(address _tokenImage) external onlyOwner {
        tokenImage = _tokenImage;
    }

    /**
     * @dev Deploys a new TokenProxy contract, using saved token image contract as a template.
     * @param _name deployed token name.
     * @param _symbol deployed token symbol.
     * @param _decimals deployed token decimals.
     * @param _chainId chain id of the current environment.
     * @return address of a newly created contract.
     */
    function deploy(string _name, string _symbol, uint8 _decimals, uint256 _chainId) external returns (address) {
        return new TokenProxy(tokenImage, _name, _symbol, _decimals, _chainId, msg.sender);
    }
}
