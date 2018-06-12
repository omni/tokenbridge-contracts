pragma solidity 0.4.24;
import "../../libraries/SafeMath.sol";
import "../../libraries/Message.sol";
import "../U_BasicBridge.sol";
import "../../IBurnableMintableERC677Token.sol";
import "../../ERC677Receiver.sol";
import "openzeppelin-solidity/contracts/token/ERC20/ERC20Basic.sol";


contract ForeignBridgeErcToErc is BasicBridge {
    using SafeMath for uint256;

    event Withdraw(address recipient, uint256 value);

    function initialize(
        address _validatorContract,
        address _erc20token
    ) public returns(bool) {
        require(!isInitialized());
        require(_validatorContract != address(0));
        addressStorage[keccak256(abi.encodePacked("validatorContract"))] = _validatorContract;
        setErc20token(_erc20token);
        uintStorage[keccak256(abi.encodePacked("deployedAtBlock"))] = block.number;
        setInitialize(true);
        return isInitialized();
    }

    function claimTokens(address _token, address _to) external onlyOwner {
        require(_token != address(erc20token()));
        require(_to != address(0));
        if (_token == address(0)) {
            _to.transfer(address(this).balance);
            return;
        }

        ERC20Basic token = ERC20Basic(_token);
        uint256 balance = token.balanceOf(this);
        require(token.transfer(_to, balance));
    }

    function erc20token() public view returns(ERC20Basic) {
        return ERC20Basic(addressStorage[keccak256(abi.encodePacked("erc20token"))]);
    }

    function withdraw(uint8[] vs, bytes32[] rs, bytes32[] ss, bytes message) external {
        Message.hasEnoughValidSignatures(message, vs, rs, ss, validatorContract());
        address recipient;
        uint256 amount;
        bytes32 txHash;
        (recipient, amount, txHash) = Message.parseMessage(message);
        require(!withdrawals(txHash));
        setWithdrawals(txHash, true);

        require(erc20token().transfer(recipient, amount));
        emit Withdraw(recipient, amount);
    }

    function withdrawals(bytes32 _withdraw) public view returns(bool) {
        return boolStorage[keccak256(abi.encodePacked("withdrawals", _withdraw))];
    }

    function setWithdrawals(bytes32 _withdraw, bool _status) private {
        boolStorage[keccak256(abi.encodePacked("withdrawals", _withdraw))] = _status;
    }

    function setErc20token(address _token) private {
        require(_token != address(0));
        addressStorage[keccak256(abi.encodePacked("erc20token"))] = _token;
    }
}
