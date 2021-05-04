pragma solidity 0.4.24;

import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "../interfaces/IInterestReceiver.sol";
import "../interfaces/IUniswapRouterV2.sol";
import "./Claimable.sol";

/**
 * @title InterestReceiverBase
 * @dev Base abstract contract for common functionality of interest receivers in erc-to-native bridge.
 * Contracts inherited from the contract can receive DAI and COMP tokens.
 */
contract InterestReceiverBase is IInterestReceiver, Ownable, Claimable {
    ERC20 public constant daiToken = ERC20(0x6B175474E89094C44Da98b954EedeAC495271d0F);
    ERC20 public constant compToken = ERC20(0xc00e94Cb662C3520282E6f5717214004A7f26888);
    ERC20 public constant wethToken = ERC20(0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2);
    IUniswapRouterV2 public constant uniswapRouterV2 = IUniswapRouterV2(0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D);

    uint256 public minReceivedFraction = 0;

    constructor() public {
        daiToken.approve(address(uniswapRouterV2), uint256(-1));
        compToken.approve(address(uniswapRouterV2), uint256(-1));
    }

    /**
     * @dev Updates the slippage parameter for the Uniswap operations.
     * Only owner can call this method.
     * @param _minFraction minimum percentage allowed to be received w.r.t. 1 ether (0.9 ether = 90%),
     * slippage = 1 ether - minReceivedFraction.
     */
    function setMinFractionReceived(uint256 _minFraction) external onlyOwner {
        require(_minFraction < 1 ether);
        minReceivedFraction = _minFraction;
    }

    /**
     * @dev Allows to transfer any locked token from this contract.
     * Only owner can call this method.
     * @param _token address of the token, if it is not provided (0x00..00), native coins will be transferred.
     * @param _to address that will receive the locked tokens on this contract.
     */
    function claimTokens(address _token, address _to) external onlyOwner {
        claimValues(_token, _to);
    }
}
