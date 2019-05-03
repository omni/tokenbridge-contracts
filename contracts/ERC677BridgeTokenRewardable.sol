pragma solidity 0.4.24;

import "./ERC677BridgeToken.sol";


contract ERC677BridgeTokenRewardable is ERC677BridgeToken {

    address public blockRewardContract;
    address public stakingContract;

    constructor(
        string _name,
        string _symbol,
        uint8 _decimals
    ) public ERC677BridgeToken(_name, _symbol, _decimals) {}

    function setBlockRewardContract(address _blockRewardContract) onlyOwner public {
        require(_blockRewardContract != address(0) && isContract(_blockRewardContract));
        blockRewardContract = _blockRewardContract;
    }

    function setStakingContract(address _stakingContract) onlyOwner public {
        require(_stakingContract != address(0) && isContract(_stakingContract));
        stakingContract = _stakingContract;
    }

    modifier onlyBlockRewardContract() {
        require(msg.sender == blockRewardContract);
        _;
    }

    modifier onlyStakingContract() {
        require(msg.sender == stakingContract);
        _;
    }

    function mintReward(address[] _receivers, uint256[] _rewards) external onlyBlockRewardContract {
        for (uint256 i = 0; i < _receivers.length; i++) {
            uint256 amount = _rewards[i];

            if (amount == 0) continue;

            address to = _receivers[i];

            // Mint `amount` for `to`
            totalSupply_ = totalSupply_.add(amount);
            balances[to] = balances[to].add(amount);
            emit Mint(to, amount);
            emit Transfer(address(0), to, amount);
        }
    }

    function stake(address _staker, uint256 _amount) external onlyStakingContract {
        // Transfer `_amount` from `_staker` to `stakingContract`
        require(_amount <= balances[_staker]);
        balances[_staker] = balances[_staker].sub(_amount);
        balances[stakingContract] = balances[stakingContract].add(_amount);
        emit Transfer(_staker, stakingContract, _amount);
    }

    function withdraw(address _staker, uint256 _amount) external onlyStakingContract {
        // Transfer `_amount` from `stakingContract` to `_staker`
        require(_amount <= balances[stakingContract]);
        balances[stakingContract] = balances[stakingContract].sub(_amount);
        balances[_staker] = balances[_staker].add(_amount);
        emit Transfer(stakingContract, _staker, _amount);
    }

    function transfer(address _to, uint256 _value) public returns(bool) {
        require(_to != stakingContract);
        return super.transfer(_to, _value);
    }

    function transferFrom(address _from, address _to, uint256 _value) public returns(bool) {
        require(_to != stakingContract);
        return super.transferFrom(_from, _to, _value);
    }

}
