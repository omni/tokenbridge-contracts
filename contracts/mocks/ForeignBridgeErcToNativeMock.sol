pragma solidity 0.4.24;

import "../upgradeable_contracts/erc20_to_native/ForeignBridgeErcToNative.sol";

contract ForeignBridgeErcToNativeMock is ForeignBridgeErcToNative {
    /**
     * @dev Tells the address of the DAI token in the Ganache Testchain.
     */
    function daiToken() public pure returns (ERC20) {
        return ERC20(0x0a4dBaF9656Fd88A32D087101Ee8bf399f4bd55f);
    }

    /**
     * @dev Tells the address of the cDAI token in the Ganache Testchain.
     */
    function cDaiToken() public pure returns (ICToken) {
        return ICToken(0x615cba17EE82De39162BB87dBA9BcfD6E8BcF298);
    }

    /**
     * @dev Tells the address of the Comptroller contract in the Ganache Testchain.
     */
    function comptroller() public pure returns (IComptroller) {
        return IComptroller(0x85e855b22F01BdD33eE194490c7eB16b7EdaC019);
    }

    /**
     * @dev Tells the address of the COMP token in the Ganache Testchain.
     */
    function compToken() public pure returns (ERC20) {
        return ERC20(0x6f51036Ec66B08cBFdb7Bd7Fb7F40b184482d724);
    }
}
