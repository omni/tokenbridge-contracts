pragma solidity 0.4.24;

import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "../interfaces/ERC677.sol";

/**
 * @title SafeERC20
 * @dev Helper methods for safe token transfers.
 * Functions perform additional checks to be sure that token transfer really happened.
 */
library SafeERC20 {
    using SafeMath for uint256;

    /**
     * @dev Same as ERC20.transfer(address,uint256) but with extra consistency checks.
     * @param _token address of the token contract
     * @param _to address of the receiver
     * @param _value amount of tokens to send
     */
    function safeTransfer(
        address _token,
        address _to,
        uint256 _value
    ) internal {
        LegacyERC20(_token).transfer(_to, _value);
        assembly {
            if returndatasize {
                returndatacopy(0, 0, 32)
                if iszero(mload(0)) {
                    revert(0, 0)
                }
            }
        }
    }

    /**
     * @dev Same as ERC20.transferFrom(address,address,uint256) but with extra consistency checks.
     * @param _token address of the token contract
     * @param _from address of the sender
     * @param _value amount of tokens to send
     */
    function safeTransferFrom(
        address _token,
        address _from,
        uint256 _value
    ) internal {
        LegacyERC20(_token).transferFrom(_from, address(this), _value);
        assembly {
            if returndatasize {
                returndatacopy(0, 0, 32)
                if iszero(mload(0)) {
                    revert(0, 0)
                }
            }
        }
    }
}
