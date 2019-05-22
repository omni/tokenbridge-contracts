pragma solidity 0.4.24;
import "../../libraries/SafeMath.sol";
import "../BasicBridge.sol";
import "../../IBurnableMintableERC677Token.sol";
import "../../ERC677Receiver.sol";
import "../BasicForeignBridge.sol";
import "openzeppelin-solidity/contracts/token/ERC20/ERC20Basic.sol";
import "../ERC677BridgeForBurnableMintableToken.sol";
import "./RewardableForeignBridgeNativeToErc.sol";


contract ForeignBridgeNativeToErc is ERC677Receiver, BasicBridge, BasicForeignBridge, ERC677BridgeForBurnableMintableToken, RewardableForeignBridgeNativeToErc {

    /// Event created on money withdraw.
    event UserRequestForAffirmation(address recipient, uint256 value);

    function initialize(
        address _validatorContract,
        address _erc677token,
        uint256 _dailyLimit,
        uint256 _maxPerTx,
        uint256 _minPerTx,
        uint256 _foreignGasPrice,
        uint256 _requiredBlockConfirmations,
        uint256 _homeDailyLimit,
        uint256 _homeMaxPerTx,
        address _owner
    ) public returns(bool) {
        _initialize(
            _validatorContract,
            _erc677token,
            _dailyLimit,
            _maxPerTx,
            _minPerTx,
            _foreignGasPrice,
            _requiredBlockConfirmations,
            _homeDailyLimit,
            _homeMaxPerTx,
            _owner
        );
        setInitialize(true);
        return isInitialized();
    }

    function rewardableInitialize(
        address _validatorContract,
        address _erc677token,
        uint256 _dailyLimit,
        uint256 _maxPerTx,
        uint256 _minPerTx,
        uint256 _foreignGasPrice,
        uint256 _requiredBlockConfirmations,
        uint256 _homeDailyLimit,
        uint256 _homeMaxPerTx,
        address _owner,
        address _feeManager,
        uint256 _homeFee
    ) public returns(bool) {
        _initialize(
            _validatorContract,
            _erc677token,
            _dailyLimit,
            _maxPerTx,
            _minPerTx,
            _foreignGasPrice,
            _requiredBlockConfirmations,
            _homeDailyLimit,
            _homeMaxPerTx,
            _owner
        );
        require(isContract(_feeManager));
        addressStorage[keccak256(abi.encodePacked("feeManagerContract"))] = _feeManager;
        _setFee(_feeManager, _homeFee, HOME_FEE);
        setInitialize(true);
        return isInitialized();
    }

    function getBridgeMode() public pure returns(bytes4 _data) {
        return bytes4(keccak256(abi.encodePacked("native-to-erc-core")));
    }

    function claimTokensFromErc677(address _token, address _to) external onlyIfOwnerOfProxy {
        IBurnableMintableERC677Token(erc677token()).claimTokens(_token, _to);
    }

    function _initialize(
        address _validatorContract,
        address _erc677token,
        uint256 _dailyLimit,
        uint256 _maxPerTx,
        uint256 _minPerTx,
        uint256 _foreignGasPrice,
        uint256 _requiredBlockConfirmations,
        uint256 _homeDailyLimit,
        uint256 _homeMaxPerTx,
        address _owner
    ) internal {
        require(!isInitialized());
        require(_validatorContract != address(0) && isContract(_validatorContract));
        require(_minPerTx > 0 && _maxPerTx > _minPerTx && _dailyLimit > _maxPerTx);
        require(_foreignGasPrice > 0);
        require(_homeMaxPerTx < _homeDailyLimit);
        require(_owner != address(0));
        addressStorage[keccak256(abi.encodePacked("validatorContract"))] = _validatorContract;
        setErc677token(_erc677token);
        uintStorage[keccak256(abi.encodePacked("dailyLimit"))] = _dailyLimit;
        uintStorage[keccak256(abi.encodePacked("deployedAtBlock"))] = block.number;
        uintStorage[keccak256(abi.encodePacked("maxPerTx"))] = _maxPerTx;
        uintStorage[keccak256(abi.encodePacked("minPerTx"))] = _minPerTx;
        uintStorage[keccak256(abi.encodePacked("gasPrice"))] = _foreignGasPrice;
        uintStorage[keccak256(abi.encodePacked("requiredBlockConfirmations"))] = _requiredBlockConfirmations;
        uintStorage[keccak256(abi.encodePacked("executionDailyLimit"))] = _homeDailyLimit;
        uintStorage[keccak256(abi.encodePacked("executionMaxPerTx"))] = _homeMaxPerTx;
        setOwner(_owner);
    }

    function onExecuteMessage(address _recipient, uint256 _amount, bytes32 _txHash) internal returns(bool) {
        setTotalExecutedPerDay(getCurrentDay(), totalExecutedPerDay(getCurrentDay()).add(_amount));
        uint256 valueToMint = _amount;
        address feeManager = feeManagerContract();
        if (feeManager != address(0)) {
            uint256 fee = calculateFee(valueToMint, false, feeManager, HOME_FEE);
            if (fee != 0) {
                distributeFeeFromSignatures(fee, feeManager, _txHash);
                valueToMint = valueToMint.sub(fee);
            }
        }
        return IBurnableMintableERC677Token(erc677token()).mint(_recipient, valueToMint);
    }

    function fireEventOnTokenTransfer(address _from, uint256 _value) internal {
        emit UserRequestForAffirmation(_from, _value);
    }

    function messageWithinLimits(uint256 _amount) internal view returns(bool) {
        return withinExecutionLimit(_amount);
    }

    function onFailedMessage(address, uint256, bytes32) internal {
        revert();
    }
}
