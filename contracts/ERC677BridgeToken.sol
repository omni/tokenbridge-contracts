pragma solidity 0.4.24;

import "openzeppelin-solidity/contracts/token/ERC20/BurnableToken.sol";
import "openzeppelin-solidity/contracts/token/ERC20/MintableToken.sol";
import "openzeppelin-solidity/contracts/token/ERC20/DetailedERC20.sol";
import "openzeppelin-solidity/contracts/AddressUtils.sol";
import "./interfaces/IBurnableMintableERC677Token.sol";
import "./upgradeable_contracts/Claimable.sol";

contract ERC677BridgeToken is IBurnableMintableERC677Token, DetailedERC20, BurnableToken, MintableToken, Claimable {
    
    address[] internal _bridgeContracts;
    mapping(address => bool) internal _isBridgeContract;

    event ContractFallbackCallFailed(address from, address to, uint256 value);

    constructor(string _name, string _symbol, uint8 _decimals) public DetailedERC20(_name, _symbol, _decimals) {
        // solhint-disable-previous-line no-empty-blocks
    }

    function setBridgeContracts(address[] _contracts) external onlyOwner {
        require(_contracts.length > 0);
        uint256 i;

        for (i = 0; i < _bridgeContracts.length; i++) {
            _isBridgeContract[_bridgeContracts[i]] = false;
        }

        _bridgeContracts = _contracts;

        for (i = 0; i < _contracts.length; i++) {
            require(AddressUtils.isContract(_contracts[i]));
            _isBridgeContract[_contracts[i]] = true;
        }
    }

    modifier validRecipient(address _recipient) {
        require(_recipient != address(0) && _recipient != address(this));
        /* solcov ignore next */
        _;
    }

    function bridgeContracts() external view returns (address[]) {
        return _bridgeContracts;
    }

    function transferAndCall(address _to, uint256 _value, bytes _data) external validRecipient(_to) returns (bool) {
        require(superTransfer(_to, _value));
        emit Transfer(msg.sender, _to, _value, _data);

        if (AddressUtils.isContract(_to)) {
            require(contractFallback(msg.sender, _to, _value, _data));
        }
        return true;
    }

    function getTokenInterfacesVersion() external pure returns (uint64 major, uint64 minor, uint64 patch) {
        return (2, 2, 0);
    }

    function superTransfer(address _to, uint256 _value) internal returns (bool) {
        return super.transfer(_to, _value);
    }

    function transfer(address _to, uint256 _value) public returns (bool) {
        require(superTransfer(_to, _value));
        callAfterTransfer(msg.sender, _to, _value);
        return true;
    }

    function transferFrom(address _from, address _to, uint256 _value) public returns (bool) {
        require(super.transferFrom(_from, _to, _value));
        callAfterTransfer(_from, _to, _value);
        return true;
    }

    function callAfterTransfer(address _from, address _to, uint256 _value) internal {
        if (AddressUtils.isContract(_to) && !contractFallback(_from, _to, _value, new bytes(0))) {
            require(!_isBridgeContract[_to]);
            emit ContractFallbackCallFailed(_from, _to, _value);
        }
    }

    function contractFallback(address _from, address _to, uint256 _value, bytes _data) private returns (bool) {
        return _to.call(abi.encodeWithSignature("onTokenTransfer(address,uint256,bytes)", _from, _value, _data));
    }

    function finishMinting() public returns (bool) {
        revert();
    }

    function renounceOwnership() public onlyOwner {
        revert();
    }

    function claimTokens(address _token, address _to) public onlyOwner validAddress(_to) {
        claimValues(_token, _to);
    }

    function increaseAllowance(address spender, uint256 addedValue) public returns (bool) {
        return super.increaseApproval(spender, addedValue);
    }

    function decreaseAllowance(address spender, uint256 subtractedValue) public returns (bool) {
        return super.decreaseApproval(spender, subtractedValue);
    }
}
