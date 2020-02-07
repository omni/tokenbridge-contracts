pragma solidity 0.4.24;

import "./BasicAMBNativeToErc20.sol";

/**
* @title HomeAMBNativeToErc20
* @dev Home mediator implementation for native-to-erc20 bridge intended to work on top of AMB bridge.
* It is design to be used as implementation contract of EternalStorageProxy contract.
*/
contract HomeAMBNativeToErc20 is BasicAMBNativeToErc20 {
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
    */
    function initialize(
        address _bridgeContract,
        address _mediatorContract,
        uint256[] _dailyLimitMaxPerTxMinPerTxArray, // [ 0 = dailyLimit, 1 = maxPerTx, 2 = minPerTx ]
        uint256[] _executionDailyLimitExecutionMaxPerTxArray, // [ 0 = executionDailyLimit, 1 = executionMaxPerTx ]
        uint256 _requestGasLimit,
        uint256 _decimalShift,
        address _owner
    ) external onlyRelevantSender returns (bool) {
        _initialize(
            _bridgeContract,
            _mediatorContract,
            _dailyLimitMaxPerTxMinPerTxArray,
            _executionDailyLimitExecutionMaxPerTxArray,
            _requestGasLimit,
            _decimalShift,
            _owner
        );
        setInitialize();
        return isInitialized();
    }

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
    * @param _fee value of the fee for token transfers from the foreign network.
    * @param _rewardAccountList list of addresses that will receive the fee rewards.
    */
    function rewardableInitialize(
        address _bridgeContract,
        address _mediatorContract,
        uint256[] _dailyLimitMaxPerTxMinPerTxArray, // [ 0 = dailyLimit, 1 = maxPerTx, 2 = minPerTx ]
        uint256[] _executionDailyLimitExecutionMaxPerTxArray, // [ 0 = executionDailyLimit, 1 = executionMaxPerTx ]
        uint256 _requestGasLimit,
        uint256 _decimalShift,
        address _owner,
        address _feeManager,
        uint256 _fee,
        address[] _rewardAccountList
    ) external onlyRelevantSender returns (bool) {
        _initialize(
            _bridgeContract,
            _mediatorContract,
            _dailyLimitMaxPerTxMinPerTxArray,
            _executionDailyLimitExecutionMaxPerTxArray,
            _requestGasLimit,
            _decimalShift,
            _owner
        );
        require(AddressUtils.isContract(_feeManager));
        addressStorage[FEE_MANAGER_CONTRACT] = _feeManager;
        _setFee(_feeManager, _fee);
        _initializeRewardAccounts(_rewardAccountList);
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
        setTotalSpentPerDay(getCurrentDay(), totalSpentPerDay(getCurrentDay()).add(msg.value));
        passMessage(_receiver, msg.value);
    }

    /**
    * @dev Transfers the amount of locked native tokens that were bridged from the other network.
    * If configured, it calculates, subtract and distribute the fees among the reward accounts.
    * @param _receiver address that will receive the native tokens
    * @param _value amount of native tokens to be received
    */
    function executeActionOnBridgedTokens(address _receiver, uint256 _value) internal {
        uint256 valueToTransfer = _value.mul(10**decimalShift());

        address feeManager = feeManagerContract();
        if (feeManager != address(0)) {
            uint256 fee = calculateFee(feeManager, valueToTransfer);
            if (fee != 0) {
                bytes32 txHash = transactionHash();
                distributeFee(feeManager, fee, txHash);
                valueToTransfer = valueToTransfer.sub(fee);
            }
        }

        if (!_receiver.send(valueToTransfer)) {
            (new Sacrifice).value(valueToTransfer)(_receiver);
        }
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
}
