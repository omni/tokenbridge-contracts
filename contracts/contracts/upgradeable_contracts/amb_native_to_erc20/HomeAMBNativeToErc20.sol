pragma solidity 0.4.24;

import "./BasicAMBNativeToErc20.sol";

/**
 * @title HomeAMBNativeToErc20
 * @dev Home mediator implementation for native-to-erc20 bridge intended to work on top of AMB bridge.
 * It is design to be used as implementation contract of EternalStorageProxy contract.
 */
contract HomeAMBNativeToErc20 is BasicAMBNativeToErc20 {
    bytes32 internal constant MEDIATOR_BALANCE = 0x3db340e280667ee926fa8c51e8f9fcf88a0ff221a66d84d63b4778127d97d139; // keccak256(abi.encodePacked("mediatorBalance"))

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
     * @param _feeManager address of the fee manager contract
     */
    function initialize(
        address _bridgeContract,
        address _mediatorContract,
        uint256[3] _dailyLimitMaxPerTxMinPerTxArray, // [ 0 = dailyLimit, 1 = maxPerTx, 2 = minPerTx ]
        uint256[2] _executionDailyLimitExecutionMaxPerTxArray, // [ 0 = executionDailyLimit, 1 = executionMaxPerTx ]
        uint256 _requestGasLimit,
        int256 _decimalShift,
        address _owner,
        address _feeManager
    ) external onlyRelevantSender returns (bool) {
        _initialize(
            _bridgeContract,
            _mediatorContract,
            _dailyLimitMaxPerTxMinPerTxArray,
            _executionDailyLimitExecutionMaxPerTxArray,
            _requestGasLimit,
            _decimalShift,
            _owner,
            _feeManager
        );
        setInitialize();
        return isInitialized();
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
     * @dev Validates the received native tokens and makes the request to mint the erc20 tokens on the other network.
     * @param _receiver address that will receive the erc20 tokens on the other network.
     */
    function nativeTransfer(address _receiver) internal {
        require(msg.value > 0);
        require(withinLimit(msg.value));
        addTotalSpentPerDay(getCurrentDay(), msg.value);
        setMediatorBalance(mediatorBalance().add(msg.value));
        passMessage(msg.sender, _receiver, msg.value);
    }

    /**
     * @dev Transfers the amount of locked native tokens that were bridged from the other network.
     * If configured, it calculates, subtract and distribute the fees among the reward accounts.
     * @param _receiver address that will receive the native tokens
     * @param _value amount of native tokens to be received
     */
    function executeActionOnBridgedTokens(address _receiver, uint256 _value) internal {
        uint256 valueToTransfer = _shiftValue(_value);
        setMediatorBalance(mediatorBalance().sub(valueToTransfer));

        bytes32 _messageId = messageId();
        IMediatorFeeManager feeManager = feeManagerContract();
        if (feeManager != address(0)) {
            uint256 fee = feeManager.calculateFee(valueToTransfer);
            if (fee != 0) {
                distributeFee(feeManager, fee, _messageId);
                valueToTransfer = valueToTransfer.sub(fee);
            }
        }

        Address.safeSendValue(_receiver, valueToTransfer);
        emit TokensBridged(_receiver, valueToTransfer, _messageId);
    }

    /**
     * @dev Transfers back the amount of locked native tokens that were bridged to the other network but failed.
     * @param _receiver address that will receive the native tokens
     * @param _value amount of native tokens to be received
     */
    function executeActionOnFixedTokens(address _receiver, uint256 _value) internal {
        setMediatorBalance(mediatorBalance().sub(_value));
        Address.safeSendValue(_receiver, _value);
    }

    /**
     * @dev Transfer the fee amount as native tokens to the fee manager contract.
     * @param _feeManager address that will receive the native tokens.
     * @param _fee amount of native tokens to be distribute.
     */
    function onFeeDistribution(address _feeManager, uint256 _fee) internal {
        Address.safeSendValue(_feeManager, _fee);
    }

    /**
     * @dev Tells the native balance of the contract.
     * @return the current tracked native balance of the contract.
     */
    function mediatorBalance() public view returns (uint256) {
        return uintStorage[MEDIATOR_BALANCE];
    }

    /**
     * @dev Sets the updated native balance of the contract.
     * @param _balance the new native balance of the contract.
     */
    function setMediatorBalance(uint256 _balance) internal {
        uintStorage[MEDIATOR_BALANCE] = _balance;
    }

    /**
     * @dev Allows to transfer any locked token on this contract that is not part of the bridge operations.
     * Native tokens are not allowed to be claimed.
     * @param _token address of the token.
     * @param _to address that will receive the locked tokens on this contract.
     */
    function claimTokens(address _token, address _to) public {
        require(_token != address(0));
        super.claimTokens(_token, _to);
    }

    /**
     * @dev Allows to send to the other network the amount of locked native tokens that can be forced into the contract
     * without the invocation of the required methods.
     * @param _receiver the address that will receive the tokens on the other network
     */
    function fixMediatorBalance(address _receiver) public onlyIfUpgradeabilityOwner {
        uint256 balance = address(this).balance;
        uint256 expectedBalance = mediatorBalance();
        require(balance > expectedBalance);
        uint256 diff = balance - expectedBalance;
        uint256 available = maxAvailablePerTx();
        require(available > 0);
        if (diff > available) {
            diff = available;
        }
        addTotalSpentPerDay(getCurrentDay(), diff);
        setMediatorBalance(expectedBalance.add(diff));
        passMessage(_receiver, _receiver, diff);
    }
}
