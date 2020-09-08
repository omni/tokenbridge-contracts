pragma solidity 0.4.24;

import "../ERC677BridgeTokenRewardable.sol";

contract ERC677BridgeTokenRewardableMock is ERC677BridgeTokenRewardable {
    uint256 private _blockTimestamp;

    constructor(
        string _name,
        string _symbol,
        uint8 _decimals,
        uint256 _chainId
    ) public ERC677BridgeTokenRewardable(_name, _symbol, _decimals, _chainId) {
        // solhint-disable-previous-line no-empty-blocks
    }

    function setBlockRewardContractMock(address _blockRewardContract) public {
        blockRewardContract = _blockRewardContract;
    }

    function setStakingContractMock(address _stakingContract) public {
        stakingContract = _stakingContract;
    }

    function setNow(uint256 _timestamp) public {
        _blockTimestamp = _timestamp;
    }

    function _now() internal view returns (uint256) {
        // solhint-disable-next-line not-rely-on-time
        return _blockTimestamp != 0 ? _blockTimestamp : now;
    }
}
