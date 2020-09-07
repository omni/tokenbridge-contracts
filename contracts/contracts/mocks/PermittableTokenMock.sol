pragma solidity 0.4.24;

import "../PermittableToken.sol";

contract PermittableTokenMock is PermittableToken {
    uint256 private _blockTimestamp;

    constructor(
        string _name,
        string _symbol,
        uint8 _decimals,
        uint256 _chainId
    ) public PermittableToken(_name, _symbol, _decimals, _chainId) {
        // solhint-disable-previous-line no-empty-blocks
    }

    function setNow(uint256 _timestamp) public {
        _blockTimestamp = _timestamp;
    }

    function _now() internal view returns (uint256) {
        // solhint-disable-next-line not-rely-on-time
        return _blockTimestamp != 0 ? _blockTimestamp : now;
    }
}
