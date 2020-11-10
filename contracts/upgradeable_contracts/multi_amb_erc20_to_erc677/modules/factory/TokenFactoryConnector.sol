pragma solidity 0.4.24;

import "openzeppelin-solidity/contracts/AddressUtils.sol";
import "../../../Ownable.sol";
import "./TokenFactory.sol";

contract TokenFactoryConnector is Ownable {
    bytes32 internal constant TOKEN_FACTORY_CONTRACT = 0x269c5905f777ee6391c7a361d17039a7d62f52ba9fffeb98c5ade342705731a3; // keccak256(abi.encodePacked("tokenFactoryContract"))

    /**
    * @dev Updates an address of the used TokenFactory contract used for creating new tokens.
    * @param _tokenFactory address of TokenFactory contract.
    */
    function setTokenFactory(address _tokenFactory) external onlyOwner {
        _setTokenFactory(_tokenFactory);
    }

    /**
    * @dev Retrieves an address of the token factory contract.
    * @return address of the TokenFactory contract.
    */
    function tokenFactory() public view returns (TokenFactory) {
        return TokenFactory(addressStorage[TOKEN_FACTORY_CONTRACT]);
    }

    /**
    * @dev Internal function for updating an address of the token factory contract.
    * @param _tokenFactory address of the deployed TokenFactory contract.
    */
    function _setTokenFactory(address _tokenFactory) internal {
        require(AddressUtils.isContract(_tokenFactory));
        addressStorage[TOKEN_FACTORY_CONTRACT] = _tokenFactory;
    }
}
