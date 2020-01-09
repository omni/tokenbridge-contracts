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
    */
    function initializeRToken(address _rToken, address[] _recipients, uint32[] _proportions) external onlyOwner {
        if (rToken() != address(0)) {
            removeRToken();
        }
        require(AddressUtils.isContract(_rToken));
        addressStorage[RTOKEN] = _rToken;
        createAndChangeRTokenHat(_recipients, _proportions);
    }

    /// @dev Removes rToken
    function removeRToken() public {
        removeRToken(false);
    }

    /**
    * @dev Removes rToken
    * @param _forced If true then we don't try to redeem all rTokens
    */
    function removeRToken(bool _forced) public onlyOwner {
        if (!_forced && rTokenBalance() > 0) {
            redeemAllRToken();
        }
        addressStorage[RTOKEN] = address(0);
    }

    /**
    * @dev Swaps rTokens to bridge's tokens
    * @param _redeemTokens Amount to swap
    */
    function redeemRToken(uint256 _redeemTokens) external onlyOwner {
        _redeemRToken(_redeemTokens);
    }

    /// @dev Swaps all rTokens to bridge's tokens
    function redeemAllRToken() public onlyOwner {
        rToken().redeemAll();
    }

    /**
    * @dev Swaps bridge's tokens to rTokens
    * @param _mintAmount Amount to swap
    */
    function mintRToken(uint256 _mintAmount) public {
        if (rToken() == address(0)) return;

        uint256 balanceBefore = erc20token().balanceOf(address(this));
        uint256 rBalanceBefore = rTokenBalance();

        erc20token().approve(rToken(), _mintAmount);
        rToken().mint(_mintAmount);

        uint256 balanceAfter = erc20token().balanceOf(address(this));
        uint256 rBalanceAfter = rTokenBalance();

        require(balanceAfter == balanceBefore.sub(_mintAmount) && rBalanceAfter == rBalanceBefore.add(_mintAmount));
    }

    /**
    * @dev Creates new hat (who earns interest) and sets this hat for bridge
    * @param _recipients Array of interest recipients
    * @param _proportions Array of interest proportions
    */
    function createAndChangeRTokenHat(address[] _recipients, uint32[] _proportions) public onlyOwner {
        rToken().createHat(_recipients, _proportions, true);
    }

    /// @dev Returns rToken contract address
    function rToken() public view returns (IRToken) {
        return IRToken(addressStorage[RTOKEN]);
    }

    /// @dev Returns rToken balance
    function rTokenBalance() public view returns (uint256) {
        return rToken().balanceOf(address(this));
    }

    /**
    * @dev Swaps rTokens to bridge's tokens
    * @param _redeemTokens Amount to swap
    */
    function _redeemRToken(uint256 _redeemTokens) internal {
        if (rToken() == address(0)) return;

        uint256 balanceBefore = erc20token().balanceOf(address(this));
        uint256 rBalanceBefore = rTokenBalance();

        rToken().redeem(_redeemTokens);

        uint256 balanceAfter = erc20token().balanceOf(address(this));
        uint256 rBalanceAfter = rTokenBalance();

        require(balanceAfter == balanceBefore.add(_redeemTokens) && rBalanceAfter == rBalanceBefore.sub(_redeemTokens));
    }
}
