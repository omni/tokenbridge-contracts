pragma solidity 0.4.24;

import "./BasicAMBErc677ToErc677.sol";
import "../ERC677BridgeForBurnableMintableToken.sol";
import "openzeppelin-solidity/contracts/AddressUtils.sol";
import "../../interfaces/IAMBERC677UserRequest.sol";

contract HomeAMBErc677ToErc677 is BasicAMBErc677ToErc677, ERC677BridgeForBurnableMintableToken {
    function mintTokens(address _recipient, uint256 _value) external {
        validBridgedTokens(_value);
        IBurnableMintableERC677Token(erc677token()).mint(_recipient, _value);
    }

    function getMethodOnOtherNetwork() internal pure returns (bytes4) {
        return IAMBERC677UserRequest(0).unlockTokens.selector;
    }
}
