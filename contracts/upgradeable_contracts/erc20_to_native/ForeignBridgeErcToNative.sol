pragma solidity 0.4.24;

import "../../libraries/Message.sol";
import "../BasicForeignBridge.sol";
import "../../interfaces/IBurnableMintableERC677Token.sol";
import "openzeppelin-solidity/contracts/token/ERC20/ERC20Basic.sol";


contract ForeignBridgeErcToNative is BasicForeignBridge {
    event RelayedMessage(address recipient, uint value, bytes32 transactionHash);

    function initialize(
        address _validatorContract,
        address _erc20token,
        uint256 _requiredBlockConfirmations,
        uint256 _gasPrice,
        uint256 _maxPerTx,
        uint256 _homeDailyLimit,
        uint256 _homeMaxPerTx,
        address _owner
    ) public returns(bool) {
        require(!isInitialized());
        require(_validatorContract != address(0) && isContract(_validatorContract));
        require(_requiredBlockConfirmations != 0);
        require(_gasPrice > 0);
        require(_homeMaxPerTx < _homeDailyLimit);
        require(_owner != address(0));
        addressStorage[keccak256(abi.encodePacked("validatorContract"))] = _validatorContract;
        setErc20token(_erc20token);
        uintStorage[keccak256(abi.encodePacked("deployedAtBlock"))] = block.number;
        uintStorage[keccak256(abi.encodePacked("requiredBlockConfirmations"))] = _requiredBlockConfirmations;
        uintStorage[keccak256(abi.encodePacked("gasPrice"))] = _gasPrice;
        uintStorage[keccak256(abi.encodePacked("maxPerTx"))] = _maxPerTx;
        uintStorage[keccak256(abi.encodePacked("executionDailyLimit"))] = _homeDailyLimit;
        uintStorage[keccak256(abi.encodePacked("executionMaxPerTx"))] = _homeMaxPerTx;
        setOwner(_owner);
        setInitialize();
        return isInitialized();
    }

    function getBridgeMode() public pure returns(bytes4 _data) {
        return bytes4(keccak256(abi.encodePacked("erc-to-native-core")));
    }

    function claimTokens(address _token, address _to) public {
        require(_token != address(erc20token()));
        super.claimTokens(_token, _to);
    }

    function erc20token() public view returns(ERC20Basic) {
        return ERC20Basic(addressStorage[keccak256(abi.encodePacked("erc20token"))]);
    }

    function onExecuteMessage(address _recipient, uint256 _amount, bytes32 _txHash) internal returns(bool) {
        setTotalExecutedPerDay(getCurrentDay(), totalExecutedPerDay(getCurrentDay()).add(_amount));
        return erc20token().transfer(_recipient, _amount);
    }

    function setErc20token(address _token) private {
        require(_token != address(0) && isContract(_token));
        addressStorage[keccak256(abi.encodePacked("erc20token"))] = _token;
    }

    function onFailedMessage(address, uint256, bytes32) internal {
        revert();
    }
}
