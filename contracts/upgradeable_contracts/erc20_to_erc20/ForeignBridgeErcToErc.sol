pragma solidity 0.4.24;

import "./BasicForeignBridgeErcToErc.sol";
import "../ERC20Bridge.sol";

// solhint-disable-next-line no-empty-blocks
contract ForeignBridgeErcToErc is BasicForeignBridgeErcToErc, ERC20Bridge {}
