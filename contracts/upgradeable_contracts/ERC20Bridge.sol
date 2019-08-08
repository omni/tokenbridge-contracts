pragma solidity 0.4.24;

import "../upgradeability/EternalStorage.sol";
import "openzeppelin-solidity/contracts/token/ERC20/ERC20Basic.sol";
import "openzeppelin-solidity/contracts/AddressUtils.sol";

contract ERC20Bridge is EternalStorage {
    bytes32 internal constant ERC20_TOKEN = keccak256(abi.encodePacked("erc20token"));

    function erc20token() public view returns (ERC20Basic) {
        return ERC20Basic(addressStorage[ERC20_TOKEN]);
    }

    function setErc20token(address _token) internal {
        require(AddressUtils.isContract(_token));
        addressStorage[ERC20_TOKEN] = _token;
    }
}
