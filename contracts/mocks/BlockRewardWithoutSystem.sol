pragma solidity ^0.4.24;

import "../upgradeable_contracts/amb_erc20_to_native/BlockReward.sol";

contract BlockRewardWithoutSystem is BlockReward {
    address public bridgeContractAddress;

    modifier onlySystem {
        _;
    }

    modifier onlyBridgeContract {
        _;
    }

    function setBridgeContractAddress(address _addr) external {
        bridgeContractAddress = _addr;
    }

    function bridgesAllowed() public view returns (address[bridgesAllowedLength]) {
        // These values must be changed before deploy
        return [address(bridgeContractAddress)];
    }
}
