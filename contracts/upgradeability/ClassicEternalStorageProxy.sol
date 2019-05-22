pragma solidity 0.4.24;

import "./EternalStorage.sol";
import "./OwnedUpgradeabilityProxy.sol";


contract ClassicEternalStorageProxy is EternalStorage, OwnedUpgradeabilityProxy {

    function () payable public {
        address _impl = implementation();
        require(_impl != address(0));
        uint256 len = getSize(msg.sig);
        assembly {
            let ptr := mload(0x40)
            calldatacopy(ptr, 0, calldatasize)
            let result := delegatecall(gas, _impl, ptr, calldatasize, 0, len)

            switch result
            case 0 { revert(0, len) }
            default { return(0, len) }
        }
    }

    function getSize(bytes4 sig) public view returns(uint256) {
        uint256 ret = uintStorage[keccak256(abi.encodePacked("dataSizes", sig))];
        if (ret == 0) {
            ret = 32;
        }
        return ret;
    }
}
