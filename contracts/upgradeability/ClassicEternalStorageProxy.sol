pragma solidity 0.4.19;

import "./EternalStorage.sol";
import "./OwnedUpgradeabilityProxy.sol";


contract ClassicEternalStorageProxy is OwnedUpgradeabilityProxy, EternalStorage {

    function () payable public {
        address _impl = implementation();
        require(_impl != address(0));
        bytes4 sig;
        assembly { sig := calldataload(0) }
        uint256 len = getSize(sig);
        assembly {
            calldatacopy(0x0, 0x0, calldatasize)
            let result := delegatecall(gas, _impl, 0x0, calldatasize, 0, len)

            switch result
            case 0 { revert(0, len) }
            default { return(0, len) }
        }
    }

    function getSize(bytes4 sig) public pure returns(uint256) {
        if (bytes4(sha3("signature(bytes32,uint256)")) == sig) {
            return 132;
        }
        if (bytes4(sha3("message(bytes32)")) == sig) {
            return 210;
        }

        return 32;
    }
}
