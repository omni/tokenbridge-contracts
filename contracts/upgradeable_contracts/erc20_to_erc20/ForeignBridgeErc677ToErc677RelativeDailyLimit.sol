pragma solidity 0.4.24;

import "./ForeignBridgeErc677ToErc677.sol";
import "./BasicForeignBridgeErcToErcRelativeDailyLimit.sol";

// solhint-disable-next-line no-empty-blocks
contract ForeignBridgeErc677ToErc677RelativeDailyLimit is
    BasicForeignBridgeErcToErcRelativeDailyLimit,
    ForeignBridgeErc677ToErc677
{}
