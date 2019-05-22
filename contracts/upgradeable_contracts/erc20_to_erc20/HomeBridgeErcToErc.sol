pragma solidity 0.4.24;
import "../../libraries/SafeMath.sol";
import "../../libraries/Message.sol";
import "../BasicBridge.sol";
import "../../upgradeability/EternalStorage.sol";
import "../../IBurnableMintableERC677Token.sol";
import "../../ERC677Receiver.sol";
import "../BasicHomeBridge.sol";
import "../OverdrawManagement.sol";
import "./RewardableHomeBridgeErcToErc.sol";
import "../ERC677BridgeForBurnableMintableToken.sol";


contract HomeBridgeErcToErc is ERC677Receiver, EternalStorage, BasicBridge, BasicHomeBridge, ERC677BridgeForBurnableMintableToken, OverdrawManagement, RewardableHomeBridgeErcToErc {

    event AmountLimitExceeded(address recipient, uint256 value, bytes32 transactionHash);

    function initialize (
        address _validatorContract,
        uint256 _dailyLimit,
        uint256 _maxPerTx,
        uint256 _minPerTx,
        uint256 _homeGasPrice,
        uint256 _requiredBlockConfirmations,
        address _erc677token,
        uint256 _foreignDailyLimit,
        uint256 _foreignMaxPerTx,
        address _owner
    ) public
      returns(bool)
    {
        _initialize (
            _validatorContract,
            _dailyLimit,
            _maxPerTx,
            _minPerTx,
            _homeGasPrice,
            _requiredBlockConfirmations,
            _erc677token,
            _foreignDailyLimit,
            _foreignMaxPerTx,
            _owner
        );
        setInitialize(true);

        return isInitialized();
    }

    function rewardableInitialize (
        address _validatorContract,
        uint256 _dailyLimit,
        uint256 _maxPerTx,
        uint256 _minPerTx,
        uint256 _homeGasPrice,
        uint256 _requiredBlockConfirmations,
        address _erc677token,
        uint256 _foreignDailyLimit,
        uint256 _foreignMaxPerTx,
        address _owner,
        address _feeManager,
        uint256 _homeFee,
        uint256 _foreignFee
    ) public
    returns(bool)
    {
        _rewardableInitialize (
            _validatorContract,
            _dailyLimit,
            _maxPerTx,
            _minPerTx,
            _homeGasPrice,
            _requiredBlockConfirmations,
            _erc677token,
            _foreignDailyLimit,
            _foreignMaxPerTx,
            _owner,
            _feeManager,
            _homeFee,
            _foreignFee
        );
        setInitialize(true);

        return isInitialized();
    }

    function _rewardableInitialize (
        address _validatorContract,
        uint256 _dailyLimit,
        uint256 _maxPerTx,
        uint256 _minPerTx,
        uint256 _homeGasPrice,
        uint256 _requiredBlockConfirmations,
        address _erc677token,
        uint256 _foreignDailyLimit,
        uint256 _foreignMaxPerTx,
        address _owner,
        address _feeManager,
        uint256 _homeFee,
        uint256 _foreignFee
    ) internal
    returns(bool)
    {
        _initialize (
            _validatorContract,
            _dailyLimit,
            _maxPerTx,
            _minPerTx,
            _homeGasPrice,
            _requiredBlockConfirmations,
            _erc677token,
            _foreignDailyLimit,
            _foreignMaxPerTx,
            _owner
        );
        require(isContract(_feeManager));
        addressStorage[keccak256(abi.encodePacked("feeManagerContract"))] = _feeManager;
        _setFee(_feeManager, _homeFee, HOME_FEE);
        _setFee(_feeManager, _foreignFee, FOREIGN_FEE);
    }

    function _initialize (
        address _validatorContract,
        uint256 _dailyLimit,
        uint256 _maxPerTx,
        uint256 _minPerTx,
        uint256 _homeGasPrice,
        uint256 _requiredBlockConfirmations,
        address _erc677token,
        uint256 _foreignDailyLimit,
        uint256 _foreignMaxPerTx,
        address _owner
    ) internal
    returns(bool)
    {
        require(!isInitialized());
        require(_validatorContract != address(0) && isContract(_validatorContract));
        require(_homeGasPrice > 0);
        require(_requiredBlockConfirmations > 0);
        require(_minPerTx > 0 && _maxPerTx > _minPerTx && _dailyLimit > _maxPerTx);
        require(_foreignMaxPerTx < _foreignDailyLimit);
        require(_owner != address(0));
        addressStorage[keccak256(abi.encodePacked("validatorContract"))] = _validatorContract;
        uintStorage[keccak256(abi.encodePacked("deployedAtBlock"))] = block.number;
        uintStorage[keccak256(abi.encodePacked("dailyLimit"))] = _dailyLimit;
        uintStorage[keccak256(abi.encodePacked("maxPerTx"))] = _maxPerTx;
        uintStorage[keccak256(abi.encodePacked("minPerTx"))] = _minPerTx;
        uintStorage[keccak256(abi.encodePacked("gasPrice"))] = _homeGasPrice;
        uintStorage[keccak256(abi.encodePacked("requiredBlockConfirmations"))] = _requiredBlockConfirmations;
        uintStorage[keccak256(abi.encodePacked("executionDailyLimit"))] = _foreignDailyLimit;
        uintStorage[keccak256(abi.encodePacked("executionMaxPerTx"))] = _foreignMaxPerTx;
        setOwner(_owner);
        setErc677token(_erc677token);
    }

    function getBridgeMode() public pure returns(bytes4 _data) {
        return bytes4(keccak256(abi.encodePacked("erc-to-erc-core")));
    }

    function () payable public {
        revert();
    }

    function onExecuteAffirmation(address _recipient, uint256 _value, bytes32 txHash) internal returns(bool) {
        setTotalExecutedPerDay(getCurrentDay(), totalExecutedPerDay(getCurrentDay()).add(_value));
        uint256 valueToMint = _value;
        address feeManager = feeManagerContract();
        if (feeManager != address(0)) {
            uint256 fee = calculateFee(valueToMint, false, feeManager, FOREIGN_FEE);
            distributeFeeFromAffirmation(fee, feeManager, txHash);
            valueToMint = valueToMint.sub(fee);
        }
        return IBurnableMintableERC677Token(erc677token()).mint(_recipient, valueToMint);
    }

    function fireEventOnTokenTransfer(address _from, uint256 _value) internal {
        uint256 valueToTransfer = _value;
        address feeManager = feeManagerContract();
        if (feeManager != address(0)) {
            uint256 fee = calculateFee(valueToTransfer, false, feeManager, HOME_FEE);
            valueToTransfer = valueToTransfer.sub(fee);
        }
        emit UserRequestForSignature(_from, valueToTransfer);
    }

    function onSignaturesCollected(bytes _message) internal {
        address feeManager = feeManagerContract();
        if (feeManager != address(0)) {
            address recipient;
            uint256 amount;
            bytes32 txHash;
            address contractAddress;
            (recipient, amount, txHash, contractAddress) = Message.parseMessage(_message);
            uint256 fee = calculateFee(amount, true, feeManager, HOME_FEE);
            distributeFeeFromSignatures(fee, feeManager, txHash);
        }
    }

    function affirmationWithinLimits(uint256 _amount) internal view returns(bool) {
        return withinExecutionLimit(_amount);
    }

    function onFailedAffirmation(address _recipient, uint256 _value, bytes32 _txHash) internal {
        address recipient;
        uint256 value;
        (recipient, value) = txAboveLimits(_txHash);
        require(recipient == address(0) && value == 0);
        setOutOfLimitAmount(outOfLimitAmount().add(_value));
        setTxAboveLimits(_recipient, _value, _txHash);
        emit AmountLimitExceeded(_recipient, _value, _txHash);
    }
}
