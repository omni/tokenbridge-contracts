pragma solidity 0.4.21;

import "zeppelin-solidity/contracts/token/ERC20/BurnableToken.sol";
import "zeppelin-solidity/contracts/token/ERC20/MintableToken.sol";
import "zeppelin-solidity/contracts/token/ERC20/DetailedERC20.sol";
import "./IBurnableMintableERC677Token.sol";
import "./ERC677Receiver.sol";


contract POA20 is
    IBurnableMintableERC677Token,
    DetailedERC20,
    BurnableToken,
    MintableToken {
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
        bool result = super.transfer(_to, _value);
        emit Transfer(msg.sender, _to, _value, _data);
        if (isContract(_to)) {
            result = contractFallback(_to, _value, _data);
        }
        return result;
    }

    function contractFallback(address _to, uint _value, bytes _data)
        private
        returns(bool)
    {
        ERC677Receiver receiver = ERC677Receiver(_to);
        return receiver.onTokenTransfer(msg.sender, _value, _data);
    }

    function isContract(address _addr)
        private
        returns (bool hasCode)
    {
        uint length;
        assembly { length := extcodesize(_addr) }
        return length > 0;
    }

    function finishMinting() public returns (bool) {
        revert();
    }

}
