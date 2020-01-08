pragma solidity 0.4.24;

import "openzeppelin-solidity/contracts/AddressUtils.sol";
import "../interfaces/IRToken.sol";
import "./Ownable.sol";
import "./ERC20Bridge.sol";

/**
* @title RTokenConnector
* @dev This logic allows to use RToken (https://github.com/rtoken-project/rtoken-contracts)
*/
contract RTokenConnector is Ownable, ERC20Bridge {
    bytes32 internal constant RTOKEN = 0xdce7cb71f7466970418465f97f1fb7d721c1661bc59b1f0caa7d1f8ce374a47e; // keccak256(abi.encodePacked("rToken"))

    /**
    * @dev Sets rToken contract address and creates a hat with array of interest recipients
    * @param _rToken rToken contract address
    * @param _recipients Array of interest recipients
    * @param _proportions Array of interest proportions
    * @return Returns ID of the created hat
    */
    function initializeRToken(address _rToken, address[] _recipients, uint32[] _proportions)
        external
        onlyOwner
        returns (uint256)
    {
        require(AddressUtils.isContract(_rToken));
        addressStorage[RTOKEN] = _rToken;
        return createAndChangeRTokenHat(_recipients, _proportions);
    }

    /// @dev Removes rToken
    function removeRToken() external onlyOwner {
        addressStorage[RTOKEN] = address(0);
    }

    /**
    * @dev Swaps rTokens to bridge's tokens
    * @param _redeemTokens Amount to swap
    */
    function redeemRToken(uint256 _redeemTokens) external onlyOwner {
        _redeemRToken(_redeemTokens);
    }

    /**
    * @dev Swaps bridge's tokens to rTokens
    * @param _mintAmount Amount to swap
    */
    function mintRToken(uint256 _mintAmount) public {
        address rTokenAddress = rToken();
        if (rTokenAddress == address(0)) return;
        erc20token().approve(rTokenAddress, _mintAmount);
        IRToken(rTokenAddress).mint(_mintAmount);
    }

    /**
    * @dev Creates new hat (who earns interest) and sets this hat for bridge
    * @param _recipients Array of interest recipients
    * @param _proportions Array of interest proportions
    * @return Returns ID of the created hat
    */
    function createAndChangeRTokenHat(address[] _recipients, uint32[] _proportions) public onlyOwner returns (uint256) {
        return IRToken(rToken()).createHat(_recipients, _proportions, true);
    }

    /// @dev Returns rToken contract address
    function rToken() public view returns (address) {
        return addressStorage[RTOKEN];
    }

    /**
    * @dev Swaps rTokens to bridge's tokens
    * @param _redeemTokens Amount to swap
    */
    function _redeemRToken(uint256 _redeemTokens) internal {
        if (rToken() == address(0)) return;
        IRToken(rToken()).redeem(_redeemTokens);
    }
}
