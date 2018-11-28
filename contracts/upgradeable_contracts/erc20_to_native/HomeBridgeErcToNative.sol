pragma solidity 0.4.24;
import "../../libraries/SafeMath.sol";
import "../../libraries/Message.sol";
import "../BasicBridge.sol";
import "../../upgradeability/EternalStorage.sol";
import "../../IBlockReward.sol";
import "../../ERC677Receiver.sol";
import "../BasicHomeBridge.sol";
import "../ERC677Bridge.sol";


contract HomeBridgeErcToNative is EternalStorage, BasicBridge, BasicHomeBridge {

    event AmountLimitExceeded(address recipient, uint256 value, bytes32 transactionHash);

    function () public payable {
        require(msg.value > 0);
        require(msg.data.length == 0);
        require(withinLimit(msg.value));
        IBlockReward blockReward = blockRewardContract();
        uint256 totalMinted = blockReward.mintedTotallyByBridge(address(this));
        require(msg.value <= totalMinted.sub(totalBurntCoins()));
        setTotalSpentPerDay(getCurrentDay(), totalSpentPerDay(getCurrentDay()).add(msg.value));
        setTotalBurntCoins(totalBurntCoins().add(msg.value));
        address(0).transfer(msg.value);
        emit UserRequestForSignature(msg.sender, msg.value);
    }

    function initialize (
        address _validatorContract,
        uint256 _dailyLimit,
        uint256 _maxPerTx,
        uint256 _minPerTx,
        uint256 _homeGasPrice,
        uint256 _requiredBlockConfirmations,
        address _blockReward,
        uint256 _foreignDailyLimit,
        uint256 _foreignMaxPerTx
    ) public returns(bool)
    {
        require(!isInitialized());
        require(_validatorContract != address(0) && isContract(_validatorContract));
        require(_requiredBlockConfirmations > 0);
        require(_minPerTx > 0 && _maxPerTx > _minPerTx && _dailyLimit > _maxPerTx);
        require(_blockReward == address(0) || isContract(_blockReward));
        require(_foreignMaxPerTx < _foreignDailyLimit);
        addressStorage[keccak256(abi.encodePacked("validatorContract"))] = _validatorContract;
        uintStorage[keccak256(abi.encodePacked("deployedAtBlock"))] = block.number;
        uintStorage[keccak256(abi.encodePacked("dailyLimit"))] = _dailyLimit;
        uintStorage[keccak256(abi.encodePacked("maxPerTx"))] = _maxPerTx;
        uintStorage[keccak256(abi.encodePacked("minPerTx"))] = _minPerTx;
        uintStorage[keccak256(abi.encodePacked("gasPrice"))] = _homeGasPrice;
        uintStorage[keccak256(abi.encodePacked("requiredBlockConfirmations"))] = _requiredBlockConfirmations;
        addressStorage[keccak256(abi.encodePacked("blockRewardContract"))] = _blockReward;
        uintStorage[keccak256(abi.encodePacked("executionDailyLimit"))] = _foreignDailyLimit;
        uintStorage[keccak256(abi.encodePacked("executionMaxPerTx"))] = _foreignMaxPerTx;
        setInitialize(true);

        return isInitialized();
    }

    function getBridgeMode() public pure returns(bytes4 _data) {
        return bytes4(keccak256(abi.encodePacked("erc-to-native-core")));
    }

    function blockRewardContract() public view returns(IBlockReward) {
        return IBlockReward(addressStorage[keccak256(abi.encodePacked("blockRewardContract"))]);
    }

    function totalBurntCoins() public view returns(uint256) {
        return uintStorage[keccak256(abi.encodePacked("totalBurntCoins"))];
    }

    function setBlockRewardContract(address _blockReward) public onlyOwner {
        require(_blockReward != address(0) && isContract(_blockReward) && (IBlockReward(_blockReward).bridgesAllowedLength() != 0));
        addressStorage[keccak256(abi.encodePacked("blockRewardContract"))] = _blockReward;
    }

    function onExecuteAffirmation(address _recipient, uint256 _value) internal returns(bool) {
        setTotalExecutedPerDay(getCurrentDay(), totalExecutedPerDay(getCurrentDay()).add(_value));
        IBlockReward blockReward = blockRewardContract();
        require(blockReward != address(0));
        blockReward.addExtraReceiver(_value, _recipient);
        return true;
    }

    function fireEventOnTokenTransfer(address _from, uint256 _value) internal {
        emit UserRequestForSignature(_from, _value);
    }

    function setTotalBurntCoins(uint256 _amount) internal {
        uintStorage[keccak256(abi.encodePacked("totalBurntCoins"))] = _amount;
    }

    function affirmationWithinLimits(uint256 _amount) internal view returns(bool) {
        return withinExecutionLimit(_amount);
    }

    function onFailedAffirmation(address _recipient, uint256 _value, bytes32 _txHash) internal {
        setOutOfLimitAmount(outOfLimitAmount().add(_value));
        setTxAboveLimits(_recipient, _value, _txHash);
        emit AmountLimitExceeded(_recipient, _value, _txHash);
    }
}
