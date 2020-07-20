pragma solidity 0.4.24;

library TokenReader {
    function readName(address _token) internal view returns (string) {
        uint256 ptr;
        uint256 size;
        assembly {
            ptr := mload(0x40)
            mstore(ptr, 0x06fdde0300000000000000000000000000000000000000000000000000000000) // name()
            if iszero(staticcall(gas, _token, ptr, 4, ptr, 32)) {
                mstore(ptr, 0xa3f4df7e00000000000000000000000000000000000000000000000000000000) // NAME()
                staticcall(gas, _token, ptr, 4, ptr, 32)
                pop
            }

            mstore(0x40, add(ptr, returndatasize))

            switch gt(returndatasize, 32)
                case 1 {
                    returndatacopy(mload(0x40), 32, 32) // string length
                    size := mload(mload(0x40))
                }
                default {
                    size := returndatasize // 32 or 0
                }
        }
        string memory res = new string(size);
        assembly {
            if gt(returndatasize, 32) {
                // load as string
                returndatacopy(add(res, 32), 64, size)
                jump(exit)
            }
            /* solhint-disable */
            if gt(returndatasize, 0) {
                let i := 0
                ptr := mload(ptr) // load bytes32 value
                mstore(add(res, 32), ptr) // save value in result string

                for { } gt(ptr, 0) { i := add(i, 1) } { // until string is empty
                    ptr := shl(8, ptr) // shift left by one symbol
                }
                mstore(res, i) // save result string length
            }
            exit:
            /* solhint-enable */
        }
        return res;
    }

    function readSymbol(address _token) internal view returns (string) {
        uint256 ptr;
        uint256 size;
        assembly {
            ptr := mload(0x40)
            mstore(ptr, 0x95d89b4100000000000000000000000000000000000000000000000000000000) // symbol()
            if iszero(staticcall(gas, _token, ptr, 4, ptr, 32)) {
                mstore(ptr, 0xf76f8d7800000000000000000000000000000000000000000000000000000000) // SYMBOl()
                staticcall(gas, _token, ptr, 4, ptr, 32)
                pop
            }

            mstore(0x40, add(ptr, returndatasize))

            switch gt(returndatasize, 32)
                case 1 {
                    returndatacopy(mload(0x40), 32, 32) // string length
                    size := mload(mload(0x40))
                }
                default {
                    size := returndatasize // 32 or 0
                }
        }
        string memory res = new string(size);
        assembly {
            if gt(returndatasize, 32) {
                // load as string
                returndatacopy(add(res, 32), 64, size)
                jump(exit)
            }
            /* solhint-disable */
            if gt(returndatasize, 0) {
                let i := 0
                ptr := mload(ptr) // load bytes32 value
                mstore(add(res, 32), ptr) // save value in result string

                for { } gt(ptr, 0) { i := add(i, 1) } { // until string is empty
                    ptr := shl(8, ptr) // shift left by one symbol
                }
                mstore(res, i) // save result string length
            }
            exit:
            /* solhint-enable */
        }
        return res;
    }

    function readDecimals(address _token) internal view returns (uint256) {
        uint256 decimals;
        assembly {
            let ptr := mload(0x40)
            mstore(0x40, add(ptr, 32))
            mstore(ptr, 0x313ce56700000000000000000000000000000000000000000000000000000000) // decimals()
            if iszero(staticcall(gas, _token, ptr, 4, ptr, 32)) {
                mstore(ptr, 0x2e0f262500000000000000000000000000000000000000000000000000000000) // DECIMALS()
                if iszero(staticcall(gas, _token, ptr, 4, ptr, 32)) {
                    mstore(ptr, 0)
                }
            }
            decimals := mload(ptr)
        }
        return decimals;
    }
}
