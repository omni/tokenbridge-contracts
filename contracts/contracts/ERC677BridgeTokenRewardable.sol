pragma solidity 0.4.24;

import "./ERC677MultiBridgeToken.sol";

contract ERC677BridgeTokenRewardable is ERC677MultiBridgeToken {
    address public blockRewardContract;
    address public stakingContract;

    constructor(
        string _name,
        string _symbol,
        uint8 _decimals,
        uint256 _chainId
    ) public ERC677MultiBridgeToken(_name, _symbol, _decimals, _chainId) {
        // solhint-disable-previous-line no-empty-blocks
    }

    function setBlockRewardContract(address _blockRewardContract) external onlyOwner {
        require(AddressUtils.isContract(_blockRewardContract));
        blockRewardContract = _blockRewardContract;
    }

    function setStakingContract(address _stakingContract) external onlyOwner {
        require(AddressUtils.isContract(_stakingContract));
        require(balanceOf(_stakingContract) == 0);
        stakingContract = _stakingContract;
    }

    modifier onlyBlockRewardContract() {
        require(msg.sender == blockRewardContract);
        /* solcov ignore next */
        _;
    }

    modifier onlyStakingContract() {
        require(msg.sender == stakingContract);
        /* solcov ignore next */
        _;
    }

    function mintReward(uint256 _amount) external onlyBlockRewardContract {
        if (_amount == 0) return;
        // Mint `_amount` for the BlockReward contract
        address to = blockRewardContract;
        totalSupply_ = totalSupply_.add(_amount);
        balances[to] = balances[to].add(_amount);
        emit Mint(to, _amount);
        emit Transfer(address(0), to, _amount);
    }

    function stake(address _staker, uint256 _amount) external onlyStakingContract {
        // Transfer `_amount` from `_staker` to `stakingContract`
        balances[_staker] = balances[_staker].sub(_amount);
        balances[stakingContract] = balances[stakingContract].add(_amount);
        emit Transfer(_staker, stakingContract, _amount);
    }

    function transfer(address _to, uint256 _value) public returns (bool) {
        require(_to != blockRewardContract);
        require(_to != stakingContract);
        return super.transfer(_to, _value);
    }

    function transferFrom(
        address _from,
        address _to,
        uint256 _value
    ) public returns (bool) {
        require(_to != blockRewardContract);
        require(_to != stakingContract);
        return super.transferFrom(_from, _to, _value);
    }
}
