pragma solidity 0.4.24;

import "./EternalStorageProxy.sol";

/**
 * @title ClassicEternalStorageProxy
 * @dev This proxy holds the storage of the token contract and delegates every call to the current implementation set.
 * Besides, it allows to upgrade the token's behaviour towards further implementations, and provides basic
 * authorization control functionalities.
 * The only difference between this contract and EternalStorageProxy is a provided support of pre-Byzantium environment.
 * The fallback proxy will return values with a default size of 32. If a method will be returning a different size,
 * the size needs to be stored for the signature so the method getSize() can get it.
 */
contract ClassicEternalStorageProxy is EternalStorageProxy {
    // solhint-disable-next-line no-complex-fallback
    function() public payable {
        address _impl = implementation();
        require(_impl != address(0));
        uint256 len = getSize(msg.sig);
        assembly {
            let ptr := mload(0x40)
            calldatacopy(ptr, 0, calldatasize)
            /*
                instead of reading `returndatasize` and `returdatacopy` later,
                this stores the returned data directly into the memory
            */
            let result := delegatecall(gas, _impl, ptr, calldatasize, 0, len)

            switch result
                case 0 {
                    revert(0, len)
                }
                default {
                    return(0, len)
                }
        }
    }

    /**
    * @dev Tells the called function return data size
    * @param sig representing the signature of a called function
    * @return size of return data in bytes
    */
    function getSize(bytes4 sig) public view returns (uint256) {
        uint256 ret = uintStorage[keccak256(abi.encodePacked("dataSizes", sig))];
        if (ret == 0) {
            ret = 32;
        }
        return ret;
    }
}
