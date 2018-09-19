pragma solidity 0.4.24;
import "../../libraries/SafeMath.sol";
import "../../libraries/Message.sol";
import "../BasicBridge.sol";
import "../BasicForeignBridge.sol";
import "../../IBurnableMintableERC677Token.sol";
import "../../ERC677Receiver.sol";
import "openzeppelin-solidity/contracts/token/ERC20/ERC20Basic.sol";


contract ForeignBridgeErcToNative is BasicBridge, BasicForeignBridge {
    event RelayedMessage(address recipient, uint value, bytes32 transactionHash);

    function initialize(
        address _validatorContract,
        address _erc20token,
        uint256 _requiredBlockConfirmations
    ) public returns(bool) {
        require(!isInitialized(), "already initialized");
        require(_validatorContract != address(0), "address cannot be empty");
        require(_requiredBlockConfirmations != 0, "requiredBlockConfirmations cannot be 0");
        addressStorage[keccak256(abi.encodePacked("validatorContract"))] = _validatorContract;
        setErc20token(_erc20token);
        uintStorage[keccak256(abi.encodePacked("deployedAtBlock"))] = block.number;
        uintStorage[keccak256(abi.encodePacked("requiredBlockConfirmations"))] = _requiredBlockConfirmations;
        setInitialize(true);
        return isInitialized();
    }

    function claimTokens(address _token, address _to) public onlyOwner {
        require(_token != address(erc20token()));
        super.claimTokens(_token, _to);
    }

    function erc20token() public view returns(ERC20Basic) {
        return ERC20Basic(addressStorage[keccak256(abi.encodePacked("erc20token"))]);
    }

    function onExecuteMessage(address _recipient, uint256 _amount) internal returns(bool) {
        return erc20token().transfer(_recipient, _amount);
    }

    function setErc20token(address _token) private {
        require(_token != address(0));
        addressStorage[keccak256(abi.encodePacked("erc20token"))] = _token;
    }
}
