pragma solidity 0.4.24;

import "./BasicAMBErc20ToNative.sol";
import "./HomeFeeManagerAMBErc20ToNative.sol";
import "../BlockRewardBridge.sol";

/**
* @title HomeAMBErc20ToNative
* @dev Home mediator implementation for erc20-to-native bridge intended to work on top of AMB bridge.
* It is design to be used as implementation contract of EternalStorageProxy contract.
*/
contract HomeAMBErc20ToNative is BasicAMBErc20ToNative, BlockRewardBridge, HomeFeeManagerAMBErc20ToNative {
    bytes32 internal constant TOTAL_BURNT_COINS = 0x17f187b2e5d1f8770602b32c1159b85c9600859277fae1eaa9982e9bcf63384c; // keccak256(abi.encodePacked("totalBurntCoins"))

    /**
    * @dev Stores the initial parameters of the mediator.
    * @param _bridgeContract the address of the AMB bridge contract.
    * @param _mediatorContract the address of the mediator contract on the other network.
    * @param _dailyLimitMaxPerTxMinPerTxArray array with limit values for the assets to be bridged to the other network.
    *   [ 0 = dailyLimit, 1 = maxPerTx, 2 = minPerTx ]
    * @param _executionDailyLimitExecutionMaxPerTxArray array with limit values for the assets bridged from the other network.
    *   [ 0 = executionDailyLimit, 1 = executionMaxPerTx ]
    * @param _requestGasLimit the gas limit for the message execution.
    * @param _decimalShift number of decimals shift required to adjust the amount of tokens bridged.
    * @param _owner address of the owner of the mediator contract
    * @param _blockReward address of the block reward contract
    */
    function initialize(
        address _bridgeContract,
        address _mediatorContract,
        uint256[3] _dailyLimitMaxPerTxMinPerTxArray, // [ 0 = dailyLimit, 1 = maxPerTx, 2 = minPerTx ]
        uint256[2] _executionDailyLimitExecutionMaxPerTxArray, // [ 0 = executionDailyLimit, 1 = executionMaxPerTx ]
        uint256 _requestGasLimit,
        int256 _decimalShift,
        address _owner,
        address _blockReward
    ) public onlyRelevantSender returns (bool) {
        _initialize(
            _bridgeContract,
            _mediatorContract,
            _dailyLimitMaxPerTxMinPerTxArray,
            _executionDailyLimitExecutionMaxPerTxArray,
            _requestGasLimit,
            _decimalShift,
            _owner
        );
        _setBlockRewardContract(_blockReward);
        setInitialize();
        return isInitialized();
    }

    /**
    * @dev Stores the initial parameters of the mediator, sets the rewardable mediator as well.
    * @param _bridgeContract the address of the AMB bridge contract.
    * @param _mediatorContract the address of the mediator contract on the other network.
    * @param _dailyLimitMaxPerTxMinPerTxArray array with limit values for the assets to be bridged to the other network.
    *   [ 0 = dailyLimit, 1 = maxPerTx, 2 = minPerTx ]
    * @param _executionDailyLimitExecutionMaxPerTxArray array with limit values for the assets bridged from the other network.
    *   [ 0 = executionDailyLimit, 1 = executionMaxPerTx ]
    * @param _requestGasLimit the gas limit for the message execution.
    * @param _decimalShift number of decimals shift required to adjust the amount of tokens bridged.
    * @param _owner address of the owner of the mediator contract
    * @param _blockReward address of the block reward contract
    * @param _rewardAddresses list of reward addresses, between whom fees will be distributed
    * @param _fees array with initial fees for both bridge directions
    *   [ 0 = homeToForeignFee, 1 = foreignToHomeFee ]
    */
    function rewardableInitialize(
        address _bridgeContract,
        address _mediatorContract,
        uint256[3] _dailyLimitMaxPerTxMinPerTxArray, // [ 0 = dailyLimit, 1 = maxPerTx, 2 = minPerTx ]
        uint256[2] _executionDailyLimitExecutionMaxPerTxArray, // [ 0 = executionDailyLimit, 1 = executionMaxPerTx ]
        uint256 _requestGasLimit,
        int256 _decimalShift,
        address _owner,
        address _blockReward,
        address[] _rewardAddresses,
        uint256[2] _fees // [ 0 = homeToForeignFee, 1 = foreignToHomeFee ]
    ) external returns (bool) {
        _setRewardAddressList(_rewardAddresses);
        _setFee(HOME_TO_FOREIGN_FEE, _fees[0]);
        _setFee(FOREIGN_TO_HOME_FEE, _fees[1]);
        return
            initialize(
                _bridgeContract,
                _mediatorContract,
                _dailyLimitMaxPerTxMinPerTxArray,
                _executionDailyLimitExecutionMaxPerTxArray,
                _requestGasLimit,
                _decimalShift,
                _owner,
                _blockReward
            );
    }

    /**
    * @dev Fallback method to be called to initiate the bridge operation of the native tokens to an erc20 representation
    * that the user will receive in the same address on the other network.
    */
    function() public payable {
        require(msg.data.length == 0);
        nativeTransfer(msg.sender);
    }

    /**
    * @dev Method to be called to initiate the bridge operation of the native tokens to an erc20 representation
    * that the user will receive in the address specified by parameter on the other network.
    * @param _receiver address that will receive the erc20 tokens on the other network.
    */
    function relayTokens(address _receiver) external payable {
        nativeTransfer(_receiver);
    }

    /**
    * @dev Updates an address of the block reward contract that is used for minting native coins.
    * @param _blockReward address of new block reward contract.
    */
    function setBlockRewardContract(address _blockReward) external onlyOwner {
        _setBlockRewardContract(_blockReward);
    }

    /**
    * @dev Retrieves address of the currently used block reward contract.
    * @return address of block reward contract.
    */
    function blockRewardContract() public view returns (IBlockReward) {
        return _blockRewardContract();
    }

    /**
    * @dev Retrieves total burnt coins by this bridge.
    * @return amount of burnt coins.
    */
    function totalBurntCoins() public view returns (uint256) {
        return uintStorage[TOTAL_BURNT_COINS];
    }

    /**
    * @dev Validates the received native tokens and makes the request to unlock the erc20 tokens on the other network.
    * @param _receiver address that will receive the erc20 tokens on the other network.
    */
    function nativeTransfer(address _receiver) internal {
        // this check also validates that msg.value is positive, since minPerTx() > 0
        require(withinLimit(msg.value));

        IBlockReward blockReward = blockRewardContract();
        uint256 totalMinted = blockReward.mintedTotallyByBridge(address(this));
        uint256 totalBurnt = totalBurntCoins();
        require(msg.value <= totalMinted.sub(totalBurnt));

        addTotalSpentPerDay(getCurrentDay(), msg.value);

        uint256 valueToTransfer = msg.value;
        bytes32 _messageId = messageId();

        uint256 fee = _distributeFee(HOME_TO_FOREIGN_FEE, valueToTransfer);
        if (fee > 0) {
            emit FeeDistributed(fee, _messageId);
            valueToTransfer = valueToTransfer.sub(fee);
        }

        passMessage(msg.sender, _receiver, valueToTransfer);
        _burnCoins(valueToTransfer);
    }

    /**
    * @dev Internal function for updating amount of burnt coins by this bridge.
    * @param _amount new amount of burned coins.
    */
    function _setTotalBurntCoins(uint256 _amount) internal {
        uintStorage[TOTAL_BURNT_COINS] = _amount;
    }

    /**
    * @dev Mints the amount of native tokens that were bridged from the other network.
    * @param _receiver address that will receive the native tokens
    * @param _value amount of native tokens to be received
    */
    function executeActionOnBridgedTokens(address _receiver, uint256 _value) internal {
        uint256 valueToMint = _shiftValue(_value);
        bytes32 _messageId = messageId();

        uint256 fee = _distributeFee(FOREIGN_TO_HOME_FEE, valueToMint);
        if (fee > 0) {
            emit FeeDistributed(fee, _messageId);
            valueToMint = valueToMint.sub(fee);
        }

        IBlockReward blockReward = blockRewardContract();
        blockReward.addExtraReceiver(valueToMint, _receiver);
        emit TokensBridged(_receiver, valueToMint, _messageId);
    }

    /**
    * @dev Mints back the amount of native tokens that were bridged to the other network but failed.
    * @param _receiver address that will receive the native tokens
    * @param _value amount of native tokens to be received
    */
    function executeActionOnFixedTokens(address _receiver, uint256 _value) internal {
        IBlockReward blockReward = blockRewardContract();
        blockReward.addExtraReceiver(_value, _receiver);
    }

    /**
    * @dev Allows to transfer any locked tokens or native coins on this contract.
    * @param _token address of the token, address(0) for native coins.
    * @param _to address that will receive the locked tokens on this contract.
    */
    function claimTokens(address _token, address _to) external onlyIfUpgradeabilityOwner {
        // In case native coins were forced into this contract by using a selfdestruct opcode,
        // they should be handled by a call to fixMediatorBalance, instead of using a claimTokens function.
        require(_token != address(0));
        claimValues(_token, _to);
    }

    /**
    * @dev Allows to send to the other network the amount of locked native tokens that can be forced into the contract
    * without the invocation of the required methods.
    * @param _receiver the address that will receive the tokens on the other network
    */
    function fixMediatorBalance(address _receiver) external onlyIfUpgradeabilityOwner validAddress(_receiver) {
        uint256 balance = address(this).balance;
        uint256 available = maxAvailablePerTx();
        if (balance > available) {
            balance = available;
        }
        require(balance > 0);
        addTotalSpentPerDay(getCurrentDay(), balance);
        passMessage(_receiver, _receiver, balance);
        _burnCoins(balance);
    }

    /**
    * @dev Internal function for "burning" native coins. Coins are burnt by sending them to address(0x00..00).
    * @param _amount amount of native coins to burn.
    */
    function _burnCoins(uint256 _amount) internal {
        _setTotalBurntCoins(totalBurntCoins().add(_amount));
        address(0).transfer(_amount);
    }

    /**
    * @dev Internal function distributing a piece of collected fee to the particular reward address.
    * @param _feeType used fee type, can be one of [HOME_TO_FOREIGN_FEE, FOREIGN_TO_HOME_FEE].
    * @param _receiver particular reward address, where the fee should be sent/minted.
    * @param _fee amount of fee to send/mint to given address.
    */
    function onFeeDistribution(bytes32 _feeType, address _receiver, uint256 _fee) internal {
        if (_feeType == HOME_TO_FOREIGN_FEE) {
            Address.safeSendValue(_receiver, _fee);
        } else {
            IBlockReward blockReward = blockRewardContract();
            blockReward.addExtraReceiver(_fee, _receiver);
        }
    }
}
