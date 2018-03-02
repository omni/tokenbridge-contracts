pragma solidity ^0.4.19;

import "zeppelin-solidity/contracts/token/ERC20/PausableToken.sol";
import "zeppelin-solidity/contracts/token/ERC20/BurnableToken.sol";
import "zeppelin-solidity/contracts/token/ERC20/MintableToken.sol";
import "zeppelin-solidity/contracts/token/ERC20/DetailedERC20.sol";
import "./IBurnableMintableERC677Token.sol";
import "./ERC677Receiver.sol";


contract POA20 is
    IBurnableMintableERC677Token,
    DetailedERC20,
    BurnableToken,
    MintableToken,
    PausableToken {
    function POA20(
        string _name,
        string _symbol,
        uint8 _decimals)
    public DetailedERC20(_name, _symbol, _decimals) {}

    modifier validRecipient(address _recipient) {
        require(_recipient != address(0) && _recipient != address(this));
        _;
    }

    function transferAndCall(address _to, uint _value, bytes _data)
        public validRecipient(_to) returns (bool)
    {
        super.transfer(_to, _value);
        Transfer(msg.sender, _to, _value, _data);
        if (isContract(_to)) {
            contractFallback(_to, _value, _data);
        }
        return true;
    }

    function contractFallback(address _to, uint _value, bytes _data)
        private
    {
        ERC677Receiver receiver = ERC677Receiver(_to);
        receiver.onTokenTransfer(msg.sender, _value, _data);
    }

    function isContract(address _addr)
        private
        returns (bool hasCode)
    {
        uint length;
        assembly { length := extcodesize(_addr) }
        return length > 0;
    }
}
