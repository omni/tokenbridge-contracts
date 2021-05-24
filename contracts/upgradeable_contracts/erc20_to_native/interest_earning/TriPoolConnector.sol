pragma solidity 0.4.24;

import "./InterestConnector.sol";
import "../../../interfaces/ITriPool.sol";
import "../../../interfaces/ICRVMinter.sol";
import "../../../interfaces/IGauge.sol";

/**
 * @title TriPoolConnector
 * @dev This contract allows to partially invest locked Dai tokens into Curve 3Pool.
 */
contract TriPoolConnector is InterestConnector {
    using SafeMath for uint256;

    uint256 internal constant SUCCESS = 0;

    /**
     * @dev Tells the address of the DAI token in the Ethereum Mainnet.
     */
    function daiToken() public pure returns (ERC20) {
        return ERC20(0x6B175474E89094C44Da98b954EedeAC495271d0F);
    }

    /**
     * @dev Tells the address of the Curve 3Pool contract in the Ethereum Mainnet.
     */
    function triPool() public pure returns (ITriPool) {
        return ITriPool(0xbEbc44782C7dB0a1A60Cb6fe97d0b483032FF1C7);
    }

    /**
     * @dev Tells the address of the Curve 3Pool LP token contract in the Ethereum Mainnet.
     */
    function lpToken() public pure returns (ERC20) {
        return ERC20(0x6c3F90f043a72FA612cbac8115EE7e52BDe6E490);
    }

    /**
     * @dev Tells the address of the Curve 3Pool Gauge in the Ethereum Mainnet.
     * This contract is used for staking 3CRV tokens and earning CRV rewards.
     */
    function triPoolGauge() public pure returns (IGauge) {
        return IGauge(0xbFcF63294aD7105dEa65aA58F8AE5BE2D9d0952A);
    }

    /**
     * @dev Tells the address of the Curve Governance CRV token minter contract in the Ethereum Mainnet.
     */
    function crvMinter() public pure returns (ICRVMinter) {
        return ICRVMinter(0xd061D61a4d941c39E5453435B6345Dc261C2fcE0);
    }

    /**
     * @dev Tells the address of the Curve Governance CRV token contract in the Ethereum Mainnet.
     */
    function crvToken() public pure returns (ERC20) {
        return ERC20(0xD533a949740bb3306d119CC777fa900bA034cd52);
    }

    /**
     * @dev Tells the current earned interest amount.
     * @param _token address of the underlying token contract.
     * @return total amount of interest that can be withdrawn now.
     */
    function interestAmount(address _token) public view returns (uint256) {
        uint256 lpBalance = _selfBalance(address(lpToken())) + _selfBalance(address(triPoolGauge()));
        uint256 underlyingBalance = triPool().calc_withdraw_one_coin(lpBalance, 0);
        // 1 DAI is reserved for possible truncation/round errors
        uint256 invested = investedAmount(_token) + 1 ether;
        return underlyingBalance > invested ? underlyingBalance - invested : 0;
    }

    /**
     * @dev Tells the opposite of interestAmount(_token), that is, the current decrease in token holdings value.
     * Should be checked if interestAmount returned zero.
     * @param _token address of the underlying token contract.
     * @return difference between current possible withdrawal value and total invested amount.
     */
    function loss(address _token) external view returns (uint256) {
        uint256 lpBalance = _selfBalance(address(lpToken())) + _selfBalance(address(triPoolGauge()));
        uint256 underlyingBalance = triPool().calc_withdraw_one_coin(lpBalance, 0);
        uint256 invested = investedAmount(_token);
        return invested > underlyingBalance ? invested - underlyingBalance : 0;
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
     * @dev Function for making internal initialization of the interest-earning protocols.
     * e.g. making required ERC20 approvals.
     */
    function _initializeInterest(address _token) internal {
        (_token);
        daiToken().approve(address(triPool()), uint256(-1));
        lpToken().approve(address(triPoolGauge()), uint256(-1));
    }

    /**
     * @dev Function for making internal disabling of the interest-earning protocols.
     * e.g. making required ERC20 zero approvals.
     */
    function _disableInterest(address _token) internal {
        (_token);
        daiToken().approve(address(triPool()), 0);
        lpToken().approve(address(triPoolGauge()), 0);
    }

    /**
     * @dev Invests the given amount of tokens to the 3Pool contract.
     * Converts _amount of TOKENs into X cTOKENs.
     * @param _token address of the token contract.
     * @param _amount amount of tokens to invest.
     */
    function _invest(address _token, uint256 _amount) internal {
        (_token);
        triPool().add_liquidity([_amount, 0, 0], 0);
        uint256 lpAmount = _selfBalance(address(lpToken()));
        triPoolGauge().deposit(lpAmount);
    }

    /**
     * @dev Claims CRV tokens.
     */
    function claimCRVAndPay() external {
        crvMinter().mint(address(triPoolGauge()));

        address crv = address(crvToken());
        uint256 interest = _selfBalance(crv);
        require(interest >= minInterestPaid(crv));
        _transferInterest(crv, interest);
    }

    /**
     * @dev Withdraws at least the given amount of tokens from the 3Pool contract.
     * Converts X cTOKENs into _amount of TOKENs.
     * @param _token address of the token contract.
     * @param _amount minimal amount of tokens to withdraw.
     */
    function _withdrawTokens(address _token, uint256 _amount) internal {
        (_token);
        uint256 lpAmount = triPool().calc_token_amount([_amount, 0, 0], false);
        // slightly adjust max allowed LP burn amount,
        // since calc_token_amount returns approximate value without taking fees into account
        lpAmount = lpAmount.mul(101).div(100);

        uint256 lpBalance = _selfBalance(address(lpToken()));
        uint256 lpGaugeBalance = _selfBalance(address(triPoolGauge()));

        // it is necessary to withdraw lp tokens from Liquidity Gauge
        // if current balance is not enough for withdrawing underlying tokens
        if (lpBalance < lpAmount) {
            uint256 gaugeWithdrawal = lpAmount - lpBalance;
            triPoolGauge().withdraw(gaugeWithdrawal > lpGaugeBalance ? lpGaugeBalance : gaugeWithdrawal);
        }
        triPool().remove_liquidity_imbalance([_amount, 0, 0], lpAmount);
    }
}
