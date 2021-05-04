pragma solidity 0.4.24;

import "./InterestConnector.sol";
import "../../interfaces/ICToken.sol";
import "../../interfaces/IComptroller.sol";

/**
 * @title CompoundConnector
 * @dev This contract allows to partially invest locked Dai tokens into Compound protocol.
 */
contract CompoundConnector is InterestConnector {
    uint256 internal constant SUCCESS = 0;

    /**
     * @dev Tells the address of the DAI token in the Ethereum Mainnet.
     */
    function daiToken() public pure returns (ERC20) {
        return ERC20(0x6B175474E89094C44Da98b954EedeAC495271d0F);
    }

    /**
     * @dev Tells the address of the cDAI token in the Ethereum Mainnet.
     */
    function cDaiToken() public pure returns (ICToken) {
        return ICToken(0x5d3a536E4D6DbD6114cc1Ead35777bAB948E3643);
    }

    /**
     * @dev Tells the address of the Comptroller contract in the Ethereum Mainnet.
     */
    function comptroller() public pure returns (IComptroller) {
        return IComptroller(0x3d9819210A31b4961b30EF54bE2aeD79B9c9Cd3B);
    }

    /**
     * @dev Tells the address of the COMP token in the Ethereum Mainnet.
     */
    function compToken() public pure returns (ERC20) {
        return ERC20(0xc00e94Cb662C3520282E6f5717214004A7f26888);
    }

    /**
     * @dev Tells the current earned interest amount.
     * @param _token address of the underlying token contract.
     * @return total amount of interest that can be withdrawn now.
     */
    function interestAmount(address _token) public view returns (uint256) {
        uint256 underlyingBalance = cDaiToken().balanceOfUnderlying(address(this));
        // 1 DAI is reserved for possible truncation/round errors
        uint256 invested = investedAmount(_token) + 1 ether;
        return underlyingBalance > invested ? underlyingBalance - invested : 0;
    }

    /**
     * @dev Tells if interest earning is supported for the specific token contract.
     * @param _token address of the token contract.
     * @return true, if interest earning is supported.
     */
    function _isInterestSupported(address _token) internal pure returns (bool) {
        return _token == address(daiToken());
    }

    /**
     * @dev Invests the given amount of tokens to the Compound protocol.
     * Converts _amount of TOKENs into X cTOKENs.
     * @param _token address of the token contract.
     * @param _amount amount of tokens to invest.
     */
    function _invest(address _token, uint256 _amount) internal {
        (_token);
        daiToken().approve(address(cDaiToken()), _amount);
        require(cDaiToken().mint(_amount) == SUCCESS);
    }

    /**
     * @dev Withdraws at least the given amount of tokens from the Compound protocol.
     * Converts X cTOKENs into _amount of TOKENs.
     * @param _token address of the token contract.
     * @param _amount minimal amount of tokens to withdraw.
     */
    function _withdrawTokens(address _token, uint256 _amount) internal {
        (_token);
        require(cDaiToken().redeemUnderlying(_amount) == SUCCESS);
    }

    /**
     * @dev Claims Comp token and transfers it to the associated interest receiver.
     */
    function claimCompAndPay() external {
        address[] memory holders = new address[](1);
        holders[0] = address(this);
        address[] memory markets = new address[](1);
        markets[0] = address(cDaiToken());
        comptroller().claimComp(holders, markets, false, true);

        address comp = address(compToken());
        uint256 interest = _selfBalance(comp);
        require(interest >= minInterestPaid(comp));
        _transferInterest(comp, interest);
    }
}
