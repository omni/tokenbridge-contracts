pragma solidity 0.4.24;

import "./BasicStakeTokenMediator.sol";
import "../BlockRewardBridge.sol";
import "./HomeStakeTokenFeeManager.sol";
import "../../interfaces/IBurnableMintableERC677Token.sol";

contract HomeStakeTokenMediator is BasicStakeTokenMediator, HomeStakeTokenFeeManager {
    /**
     * @dev Executes action on fixed tokens
     * @param _recipient address of tokens receiver
     * @param _value amount of fixed tokens
     */
    function executeActionOnBridgedTokens(address _recipient, uint256 _value) internal {
        uint256 value = _value.mul(10**decimalShift());
        IBurnableMintableERC677Token(erc677token()).mint(_recipient, value);
    }

    /**
     * @dev Executes action on incoming bridged tokens
     * @param _token address of token contract
     * @param _from address of tokens sender
     * @param _value requsted amount of bridged tokens
     * @param _data alternative receiver, if specified
     */
    function bridgeSpecificActionsOnTokenTransfer(ERC677 _token, address _from, uint256 _value, bytes _data) internal {
        if (!lock()) {
            // burn all incoming tokens
            IBurnableMintableERC677Token(_token).burn(_value);

            if (address(_blockRewardContract()) == address(0)) {
                // in case if block reward contract is not configured, the fee is not collected
                passMessage(chooseReceiver(_from, _data), _value);
            } else {
                // when block contract is defined, the calculated fee is substructed from the original value
                uint256 fee = calculateFee(_value);
                passMessage(chooseReceiver(_from, _data), _value.sub(fee));
                if (fee > 0) {
                    // the fee itself is distributed later in the block reward contract
                    _blockRewardContract().addBridgeTokenRewardReceivers(fee);
                }
            }
        }
    }

    /**
     * @dev Executes action on fixed tokens
     * @param _recipient address of tokens receiver
     * @param _value amount of fixed tokens
     */
    function executeActionOnFixedTokens(address _recipient, uint256 _value) internal {
        IBurnableMintableERC677Token(erc677token()).mint(_recipient, _value);
    }
}
