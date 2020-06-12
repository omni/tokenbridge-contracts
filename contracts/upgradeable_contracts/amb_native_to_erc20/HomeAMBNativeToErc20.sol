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
        uint256[] _dailyLimitMaxPerTxMinPerTxArray, // [ 0 = dailyLimit, 1 = maxPerTx, 2 = minPerTx ]
        uint256[] _executionDailyLimitExecutionMaxPerTxArray, // [ 0 = executionDailyLimit, 1 = executionMaxPerTx ]
        uint256 _requestGasLimit,
        uint256 _decimalShift,
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
        setTotalSpentPerDay(getCurrentDay(), totalSpentPerDay(getCurrentDay()).add(msg.value));
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
        uint256 valueToTransfer = _value.mul(10**decimalShift());
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
        require(balance > mediatorBalance());
        uint256 diff = balance.sub(mediatorBalance());
        setTotalSpentPerDay(getCurrentDay(), totalSpentPerDay(getCurrentDay()).add(diff));
        setMediatorBalance(mediatorBalance().add(diff));
        passMessage(_receiver, _receiver, diff);
    }

    /**
    * @dev Method to migrate home WETC native-to-erc bridge to a mediator
    * implementation on top of AMB
    */
    function migrateToMediator() external {
        bytes32 REQUIRED_BLOCK_CONFIRMATIONS = 0x916daedf6915000ff68ced2f0b6773fe6f2582237f92c3c95bb4d79407230071; // keccak256(abi.encodePacked("requiredBlockConfirmations"))
        bytes32 GAS_PRICE = 0x55b3774520b5993024893d303890baa4e84b1244a43c60034d1ced2d3cf2b04b; // keccak256(abi.encodePacked("gasPrice"))
        bytes32 DEPLOYED_AT_BLOCK = 0xb120ceec05576ad0c710bc6e85f1768535e27554458f05dcbb5c65b8c7a749b0; // keccak256(abi.encodePacked("deployedAtBlock"))
        bytes32 HOME_FEE_STORAGE_KEY = 0xc3781f3cec62d28f56efe98358f59c2105504b194242dbcb2cc0806850c306e7; // keccak256(abi.encodePacked("homeFee"))
        bytes32 FOREIGN_FEE_STORAGE_KEY = 0x68c305f6c823f4d2fa4140f9cf28d32a1faccf9b8081ff1c2de11cf32c733efc; // keccak256(abi.encodePacked("foreignFee"))
        bytes32 VALIDATOR_CONTRACT = 0x5a74bb7e202fb8e4bf311841c7d64ec19df195fee77d7e7ae749b27921b6ddfe; // keccak256(abi.encodePacked("validatorContract"))

        bytes32 migrationToMediatorStorage = 0x131ab4848a6da904c5c205972a9dfe59f6d2afb8c9c3acd56915f89558369213; // keccak256(abi.encodePacked("migrationToMediator"))
        require(!boolStorage[migrationToMediatorStorage]);

        // Assign new AMB parameters
        _setBridgeContract(0x0); // Will be filled with a value later
        _setMediatorContractOnOtherSide(0x0); // Will be filled with a value later
        _setRequestGasLimit(500000);

        // Update fee manager
        addressStorage[FEE_MANAGER_CONTRACT] = 0x0; // Will be filled with a value later

        // Set the balance of the mediator contract
        setMediatorBalance(address(this).balance);

        // Free old storage
        delete addressStorage[VALIDATOR_CONTRACT];
        delete uintStorage[GAS_PRICE];
        delete uintStorage[DEPLOYED_AT_BLOCK];
        delete uintStorage[REQUIRED_BLOCK_CONFIRMATIONS];
        delete uintStorage[HOME_FEE_STORAGE_KEY];
        delete uintStorage[FOREIGN_FEE_STORAGE_KEY];

        // Free storage related to proxy size returns.
        delete uintStorage[0x5e16d82565fc7ee8775cc18db290ff4010745d3fd46274a7bc7ddbebb727fa54]; // keccak256(abi.encodePacked("dataSizes", bytes4(keccak256("signature(bytes32,uint256)"))))
        delete uintStorage[0x3b0a1ac531be1657049cf649eca2510ce9e3ef7df1be26d5c248fe8b298f4374]; // keccak256(abi.encodePacked("dataSizes", bytes4(keccak256("message(bytes32)"))))

        boolStorage[migrationToMediatorStorage] = true;
    }
}
