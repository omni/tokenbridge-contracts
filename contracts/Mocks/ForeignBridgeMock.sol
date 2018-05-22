pragma solidity 0.4.21;

import "../upgradeable_contracts/U_ForeignBridge.sol";

contract ForeignBridgeMock is ForeignBridge{

	function () payable {}
}