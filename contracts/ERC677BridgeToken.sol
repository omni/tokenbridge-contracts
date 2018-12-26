pragma solidity 0.4.24;

import "openzeppelin-solidity/contracts/token/ERC20/BurnableToken.sol";
import "openzeppelin-solidity/contracts/token/ERC20/MintableToken.sol";
import "openzeppelin-solidity/contracts/token/ERC20/DetailedERC20.sol";
import "./IBurnableMintableERC677Token.sol";
import "./ERC677Receiver.sol";


contract ERC677BridgeToken is
    IBurnableMintableERC677Token,
    DetailedERC20,
    BurnableToken,
    MintableToken {

    address public bridgeContract;
    address public blockRewardContract;
    address public validatorSetContract;

    event ContractFallbackCallFailed(address from, address to, uint value);

    constructor(
        string _name,
        string _symbol,
        uint8 _decimals)
    public DetailedERC20(_name, _symbol, _decimals) {}

    function setBridgeContract(address _bridgeContract) onlyOwner public {
        require(_bridgeContract != address(0) && isContract(_bridgeContract));
        bridgeContract = _bridgeContract;
    }

    function setBlockRewardContract(address _blockRewardContract) onlyOwner public {
        require(_blockRewardContract != address(0) && isContract(_blockRewardContract));
        blockRewardContract = _blockRewardContract;
    }

    function setValidatorSetContract(address _validatorSetContract) onlyOwner public {
        require(_validatorSetContract != address(0) && isContract(_validatorSetContract));
        validatorSetContract = _validatorSetContract;
    }

    modifier validRecipient(address _recipient) {
        require(_recipient != address(0) && _recipient != address(this));
        _;
    }

    modifier onlyBlockRewardContract() {
        require(msg.sender == blockRewardContract);
        _;
    }

    modifier onlyValidatorSetContract() {
        require(msg.sender == validatorSetContract);
        _;
    }

    function transferAndCall(address _to, uint _value, bytes _data)
        external validRecipient(_to) returns (bool)
    {
        require(superTransfer(_to, _value));
        emit Transfer(msg.sender, _to, _value, _data);

        if (isContract(_to)) {
            require(contractFallback(_to, _value, _data));
        }
        return true;
    }

    function getTokenInterfacesVersion() public pure returns(uint64 major, uint64 minor, uint64 patch) {
        return (2, 0, 0);
    }

    function superTransfer(address _to, uint256 _value) internal returns(bool)
    {
        return super.transfer(_to, _value);
    }

    function transfer(address _to, uint256 _value) public returns (bool)
    {
        require(superTransfer(_to, _value));
        if (isContract(_to) && !contractFallback(_to, _value, new bytes(0))) {
            if (_to == bridgeContract) {
                revert();
            } else {
                emit ContractFallbackCallFailed(msg.sender, _to, _value);
            }
        }
        return true;
    }

    function contractFallback(address _to, uint _value, bytes _data)
        private
        returns(bool)
    {
        return _to.call(abi.encodeWithSignature("onTokenTransfer(address,uint256,bytes)",  msg.sender, _value, _data));
    }

    function isContract(address _addr)
        private
        view
        returns (bool)
    {
        uint length;
        assembly { length := extcodesize(_addr) }
        return length > 0;
    }

    function finishMinting() public returns (bool) {
        revert();
    }

    function renounceOwnership() public onlyOwner {
        revert();
    }

    function claimTokens(address _token, address _to) public onlyOwner {
        require(_to != address(0));
        if (_token == address(0)) {
            _to.transfer(address(this).balance);
            return;
        }

        DetailedERC20 token = DetailedERC20(_token);
        uint256 balance = token.balanceOf(address(this));
        require(token.transfer(_to, balance));
    }

    function mintReward(address[] _receivers, uint256[] _rewards) external onlyBlockRewardContract {
        for (uint256 i = 0; i < _receivers.length; i++) {
            address to = _receivers[i];
            uint256 amount = _rewards[i];

            // Mint `amount` for `to`
            totalSupply_ = totalSupply_.add(amount);
            balances[to] = balances[to].add(amount);
            emit Mint(to, amount);
            emit Transfer(address(0), to, amount);
        }
    }

    function stake(address _staker, uint256 _amount) external onlyValidatorSetContract {
        // Transfer `_amount` from `_staker` to `validatorSetContract`
        require(_amount <= balances[_staker]);
        balances[_staker] = balances[_staker].sub(_amount);
        balances[validatorSetContract] = balances[validatorSetContract].add(_amount);
        emit Transfer(_staker, validatorSetContract, _amount);
    }

    function withdraw(address _staker, uint256 _amount) external onlyValidatorSetContract {
        // Transfer `_amount` from `validatorSetContract` to `_staker`
        require(_amount <= balances[validatorSetContract]);
        balances[validatorSetContract] = balances[validatorSetContract].sub(_amount);
        balances[_staker] = balances[_staker].add(_amount);
        emit Transfer(validatorSetContract, _staker, _amount);
    }

}
