pragma solidity 0.4.24;

import "openzeppelin-solidity/contracts/token/ERC20/BurnableToken.sol";
import "openzeppelin-solidity/contracts/token/ERC20/MintableToken.sol";
import "openzeppelin-solidity/contracts/token/ERC20/DetailedERC20.sol";
import "openzeppelin-solidity/contracts/AddressUtils.sol";
import "./interfaces/IBurnableMintableERC677Token.sol";
import "./upgradeable_contracts/Claimable.sol";

/**
* @title ERC677BridgeToken
* @dev The basic implementation of a bridgeable ERC677-compatible token
*/
contract ERC677BridgeToken is IBurnableMintableERC677Token, DetailedERC20, BurnableToken, MintableToken, Claimable {
    bytes4 internal constant ON_TOKEN_TRANSFER = 0xa4c0ed36; // onTokenTransfer(address,uint256,bytes)

    address internal bridgeContractAddr;

    constructor(string _name, string _symbol, uint8 _decimals) public DetailedERC20(_name, _symbol, _decimals) {
        // solhint-disable-previous-line no-empty-blocks
    }

    function bridgeContract() external view returns (address) {
        return bridgeContractAddr;
    }

    function setBridgeContract(address _bridgeContract) external onlyOwner {
        require(AddressUtils.isContract(_bridgeContract));
        bridgeContractAddr = _bridgeContract;
    }

    modifier validRecipient(address _recipient) {
        require(_recipient != address(0) && _recipient != address(this));
        /* solcov ignore next */
        _;
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
        return (2, 4, 0);
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

    /**
     * @dev Internal function that calls onTokenTransfer callback on the receiver after the successful transfer.
     * Since it is not present in the original ERC677 standard, the callback is only called on the bridge contract,
     * in order to simplify UX. In other cases, this token complies with the ERC677/ERC20 standard.
     * @param _from tokens sender address.
     * @param _to tokens receiver address.
     * @param _value amount of sent tokens.
     */
    function callAfterTransfer(address _from, address _to, uint256 _value) internal {
        if (isBridge(_to)) {
            require(contractFallback(_from, _to, _value, new bytes(0)));
        }
    }

    function isBridge(address _address) public view returns (bool) {
        return _address == bridgeContractAddr;
    }

    /**
     * @dev call onTokenTransfer fallback on the token recipient contract
     * @param _from tokens sender
     * @param _to tokens recipient
     * @param _value amount of tokens that was sent
     * @param _data set of extra bytes that can be passed to the recipient
     */
    function contractFallback(address _from, address _to, uint256 _value, bytes _data) private returns (bool) {
        return _to.call(abi.encodeWithSelector(ON_TOKEN_TRANSFER, _from, _value, _data));
    }

    function finishMinting() public returns (bool) {
        revert();
    }

    function renounceOwnership() public onlyOwner {
        revert();
    }

    /**
     * @dev Withdraws the erc20 tokens or native coins from this contract.
     * @param _token address of the claimed token or address(0) for native coins.
     * @param _to address of the tokens/coins receiver.
     */
    function claimTokens(address _token, address _to) external onlyOwner {
        claimValues(_token, _to);
    }

    function increaseAllowance(address spender, uint256 addedValue) public returns (bool) {
        return super.increaseApproval(spender, addedValue);
    }

    function decreaseAllowance(address spender, uint256 subtractedValue) public returns (bool) {
        return super.decreaseApproval(spender, subtractedValue);
    }
}
