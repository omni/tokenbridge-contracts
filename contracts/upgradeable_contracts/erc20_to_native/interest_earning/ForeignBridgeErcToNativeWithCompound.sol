pragma solidity 0.4.24;

import "../ForeignBridgeErcToNative.sol";
import "./CompoundConnector.sol";

contract ForeignBridgeErcToNativeWithCompound is ForeignBridgeErcToNative, CompoundConnector {
    function upgradeTo530(address _interestReceiver) external {
        require(msg.sender == address(this));

        address dai = address(daiToken());
        _setInterestEnabled(dai, true);
        _setMinCashThreshold(dai, 1000000 ether);
        _setMinInterestPaid(dai, 1000 ether);
        _setInterestReceiver(dai, _interestReceiver);
        _initializeInterest(dai);

        address comp = address(compToken());
        _setMinInterestPaid(comp, 1);
        _setInterestReceiver(comp, _interestReceiver);

        invest(dai);
    }

    function investDai() external {
        invest(address(daiToken()));
    }

    /**
     * @dev Withdraws the erc20 tokens or native coins from this contract.
     * @param _token address of the claimed token or address(0) for native coins.
     * @param _to address of the tokens/coins receiver.
     */
    function claimTokens(address _token, address _to) external onlyIfUpgradeabilityOwner {
        // Since bridged tokens are locked at this contract, it is not allowed to claim them with the use of claimTokens function
        address bridgedToken = address(erc20token());
        require(_token != address(bridgedToken));
        require(_token != address(cDaiToken()) || !isInterestEnabled(bridgedToken));
        require(_token != address(compToken()) || !isInterestEnabled(bridgedToken));
        claimValues(_token, _to);
    }

    function ensureEnoughTokens(ERC20 token, uint256 amount) internal {
        uint256 currentBalance = token.balanceOf(address(this));

        if (currentBalance < amount) {
            uint256 withdrawAmount = (amount - currentBalance).add(minCashThreshold(address(token)));
            _withdraw(address(token), withdrawAmount);
        }
    }
}
