pragma solidity 0.4.24;

import "openzeppelin-solidity/contracts/token/ERC20/BurnableToken.sol";
import "openzeppelin-solidity/contracts/token/ERC20/MintableToken.sol";
import "openzeppelin-solidity/contracts/token/ERC20/DetailedERC20.sol";
import "./IBurnableMintableERC677Token.sol";
import "./ERC677Receiver.sol";
import "./libraries/Version.sol";


contract ERC677BridgeToken is
    IBurnableMintableERC677Token,
    DetailedERC20,
    BurnableToken,
    MintableToken {

    Version.Version public getTokenInterfacesVersion = Version.Version(2, 0, 0);
    address public bridgeContract;

    constructor(
        string _name,
        string _symbol,
        uint8 _decimals)
    public DetailedERC20(_name, _symbol, _decimals) {}

    function setBridgeContract(address _bridgeContract) onlyOwner public {
        require(_bridgeContract != address(0) && isContract(_bridgeContract));
        bridgeContract = _bridgeContract;
    }

    modifier validRecipient(address _recipient) {
        require(_recipient != address(0) && _recipient != address(this));
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

    function superTransfer(address _to, uint256 _value) internal returns(bool)
    {
        return super.transfer(_to, _value);
    }

    function transfer(address _to, uint256 _value) public returns (bool)
    {
        require(superTransfer(_to, _value));
        if (isContract(_to) && !contractFallback(_to, _value, new bytes(0)) && _to == bridgeContract) {
            revert();
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


}
