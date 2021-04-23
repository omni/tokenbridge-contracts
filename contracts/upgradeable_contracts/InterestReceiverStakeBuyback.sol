pragma solidity 0.4.24;

import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "openzeppelin-solidity/contracts/AddressUtils.sol";
import "../interfaces/IInterestReceiver.sol";
import "../interfaces/IUniswapRouterV2.sol";
import "./Claimable.sol";

/**
 * @title InterestReceiverStakeBuyback
 * @dev This contract is intended to be used together with InterestConnector module of the erc-to-native bridge.
 * Contract receives DAI and COMP tokens. All received tokens are swapped to STAKE token and burnt.
 */
contract InterestReceiverStakeBuyback is IInterestReceiver, Ownable, Claimable {
    ERC20 public constant daiToken = ERC20(0x6B175474E89094C44Da98b954EedeAC495271d0F);
    ERC20 public constant compToken = ERC20(0xc00e94Cb662C3520282E6f5717214004A7f26888);
    ERC20 public constant wethToken = ERC20(0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2);
    ERC20 public constant stakeToken = ERC20(0x0Ae055097C6d159879521C384F1D2123D1f195e6);
    IUniswapRouterV2 public constant uniswapRouterV2 = IUniswapRouterV2(0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D);

    address public constant burnAddress = 0x000000000000000000000000000000000000dEaD;

    uint256 public minReceivedFraction = 0;

    constructor() public {
        daiToken.approve(address(uniswapRouterV2), uint256(-1));
        compToken.approve(address(uniswapRouterV2), uint256(-1));
    }

    /**
     * @dev Callback function for notifying this contract about received interest.
     * @param _token address of the token contract. Should be COMP or DAI token address.
     */
    function onInterestReceived(address _token) external {
        address[] memory path = new address[](3);
        path[0] = _token;
        path[1] = wethToken;
        path[2] = address(stakeToken);
        uint256 amount = ERC20(_token).balanceOf(address(this));

        // (min received %) * (amount / 1 DAI) * (STAKE per 1 DAI)
        uint256 minAmount = (minReceivedFraction * amount * uniswapRouterV2.getAmountsOut(1 ether, path)[2]) / 10**36;

        bytes memory data = abi.encodeWithSelector(
            uniswapRouterV2.swapExactTokensForTokens.selector,
            amount,
            minAmount,
            path,
            burnAddress,
            now
        );
        address(uniswapRouterV2).call(data);
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
