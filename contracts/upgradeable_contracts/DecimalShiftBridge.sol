pragma solidity 0.4.24;

import "../upgradeability/EternalStorage.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";

contract DecimalShiftBridge is EternalStorage {
    using SafeMath for uint256;

    bytes32 internal constant DECIMAL_SHIFT = 0x1e8ecaafaddea96ed9ac6d2642dcdfe1bebe58a930b1085842d8fc122b371ee5; // keccak256(abi.encodePacked("decimalShift"))

    /**
    * @dev Internal function for setting the decimal shift for bridge operations.
    * Decimal shift can be positive, negative, or equal to zero.
    * It has the following meaning: N tokens in the foreign chain are equivalent to N * pow(10, shift) tokens on the home side.
    * @param _shift new value of decimal shift.
    */
    function _setDecimalShift(int256 _shift) internal {
        // since 1 wei * 10**77 > 2**255, it does not make any sense to use higher values
        require(_shift > -77 && _shift < 77);
        uintStorage[DECIMAL_SHIFT] = uint256(_shift);
    }

    /**
    * @dev Returns the value of foreign-to-home decimal shift.
    * @return decimal shift.
    */
    function decimalShift() public view returns (int256) {
        return int256(uintStorage[DECIMAL_SHIFT]);
    }

    /**
    * @dev Converts the amount of home tokens into the equivalent amount of foreign tokens.
    * @param _value amount of home tokens.
    * @return equivalent amount of foreign tokens.
    */
    function _unshiftValue(uint256 _value) internal view returns (uint256) {
        return _shiftUint(_value, -decimalShift());
    }

    /**
    * @dev Converts the amount of foreign tokens into the equivalent amount of home tokens.
    * @param _value amount of foreign tokens.
    * @return equivalent amount of home tokens.
    */
    function _shiftValue(uint256 _value) internal view returns (uint256) {
        return _shiftUint(_value, decimalShift());
    }

    /**
    * @dev Calculates _value * pow(10, _shift).
    * @param _value amount of tokens.
    * @param _shift decimal shift to apply.
    * @return shifted value.
    */
    function _shiftUint(uint256 _value, int256 _shift) private pure returns (uint256) {
        if (_shift == 0) {
            return _value;
        }
        if (_shift > 0) {
            return _value.mul(10**uint256(_shift));
        }
        return _value.div(10**uint256(-_shift));
    }
}
