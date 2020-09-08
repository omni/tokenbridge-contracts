pragma solidity 0.4.24;

import "./BasicAMBErc20ToNative.sol";
import "../BaseERC677Bridge.sol";
import "../ReentrancyGuard.sol";
import "../../libraries/SafeERC20.sol";

/**
 * @title ForeignAMBErc20ToNative
 * @dev Foreign mediator implementation for erc20-to-native bridge intended to work on top of AMB bridge.
 * It is design to be used as implementation contract of EternalStorageProxy contract.
 */
contract ForeignAMBErc20ToNative is BasicAMBErc20ToNative, ReentrancyGuard, BaseERC677Bridge {
    using SafeERC20 for ERC677;

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
     * @param _erc677token address of the erc677 token contract
     */
    function initialize(
        address _bridgeContract,
        address _mediatorContract,
        uint256[3] _dailyLimitMaxPerTxMinPerTxArray, // [ 0 = dailyLimit, 1 = maxPerTx, 2 = minPerTx ]
        uint256[2] _executionDailyLimitExecutionMaxPerTxArray, // [ 0 = executionDailyLimit, 1 = executionMaxPerTx ]
        uint256 _requestGasLimit,
        int256 _decimalShift,
        address _owner,
        address _erc677token
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
        setErc677token(_erc677token);
        setInitialize();
        return isInitialized();
    }

    /**
     * @dev Public getter for token contract.
     * Internal _erc677token() is hidden from the end users, in order to not confuse them with the supported token standard.
     * @return address of the used token contract
     */
    function erc20token() external view returns (ERC677) {
        return _erc677token();
    }

    /**
     * @dev It will initiate the bridge operation that will lock the amount of tokens transferred and mint the native tokens on
     * the other network. The user should first call Approve method of the ERC677 token.
     * @param _receiver address that will receive the native tokens on the other network.
     * @param _value amount of tokens to be transferred to the other network.
     */
    function relayTokens(address _receiver, uint256 _value) external {
        // This lock is to prevent calling passMessage twice.
        // When transferFrom is called, after the transfer, the ERC677 token will call onTokenTransfer from this contract
        // which will call passMessage.
        require(!lock());
        ERC677 token = _erc677token();
        require(withinLimit(_value));
        addTotalSpentPerDay(getCurrentDay(), _value);
        _setMediatorBalance(mediatorBalance().add(_value));

        setLock(true);
        token.safeTransferFrom(msg.sender, _value);
        setLock(false);
        bridgeSpecificActionsOnTokenTransfer(token, msg.sender, _value, abi.encodePacked(_receiver));
    }

    /**
     * @dev This method is called when transferAndCall is used from ERC677 to transfer the tokens to this contract.
     * It will initiate the bridge operation that will lock the amount of tokens transferred and mint the native tokens on
     * the other network.
     * @param _from address that transferred the tokens.
     * @param _value amount of tokens transferred.
     * @param _data this parameter could contain the address of an alternative receiver of the tokens on the other network,
     * otherwise it will be empty.
     */
    function onTokenTransfer(
        address _from,
        uint256 _value,
        bytes _data
    ) external returns (bool) {
        ERC677 token = _erc677token();
        require(msg.sender == address(token));
        if (!lock()) {
            require(withinLimit(_value));
            addTotalSpentPerDay(getCurrentDay(), _value);
            _setMediatorBalance(mediatorBalance().add(_value));
        }
        bridgeSpecificActionsOnTokenTransfer(token, _from, _value, _data);
        return true;
    }

    /**
     * @dev Allows to transfer any locked token on this contract that is not part of the bridge operations.
     * @param _token address of the token, if it is not provided, native tokens will be transferred.
     * @param _to address that will receive the locked tokens on this contract.
     */
    function claimTokens(address _token, address _to) public onlyIfUpgradeabilityOwner validAddress(_to) {
        require(_token != address(_erc677token()));
        claimValues(_token, _to);
    }

    /**
     * @dev Tells the token balance of the contract.
     * @return the current tracked token balance of the contract.
     */
    function mediatorBalance() public view returns (uint256) {
        return uintStorage[MEDIATOR_BALANCE];
    }

    /**
     * @dev Allows to send to the other network the amount of locked native tokens that can be forced into the contract
     * without the invocation of the required methods.
     * @param _receiver the address that will receive the tokens on the other network
     */
    function fixMediatorBalance(address _receiver) public onlyIfUpgradeabilityOwner {
        uint256 balance = _erc677token().balanceOf(address(this));
        uint256 expectedBalance = mediatorBalance();
        require(balance > expectedBalance);
        uint256 diff = balance - expectedBalance;
        uint256 available = maxAvailablePerTx();
        require(available > 0);
        if (diff > available) {
            diff = available;
        }
        addTotalSpentPerDay(getCurrentDay(), diff);
        _setMediatorBalance(expectedBalance.add(diff));
        passMessage(_receiver, _receiver, diff);
    }

    /**
     * @dev Unlock the amount of tokens that were bridged from the other network.
     * @param _receiver address that will receive the tokens
     * @param _value amount of tokens to be received
     */
    function executeActionOnBridgedTokens(address _receiver, uint256 _value) internal {
        uint256 valueToTransfer = _unshiftValue(_value);
        bytes32 _messageId = messageId();

        _setMediatorBalance(mediatorBalance().sub(valueToTransfer));
        _erc677token().safeTransfer(_receiver, valueToTransfer);
        emit TokensBridged(_receiver, valueToTransfer, _messageId);
    }

    /**
     * @dev Unlock back the amount of tokens that were bridged to the other network but failed.
     * @param _receiver address that will receive the tokens
     * @param _value amount of tokens to be received
     */
    function executeActionOnFixedTokens(address _receiver, uint256 _value) internal {
        _setMediatorBalance(mediatorBalance().sub(_value));
        _erc677token().safeTransfer(_receiver, _value);
    }

    /**
     * @dev Locks the amount of tokens and makes the request to mint the native tokens on the other network.
     * @param _from address that transferred the tokens.
     * @param _value amount of tokens transferred.
     * @param _data this parameter could contain the address of an alternative receiver of the native tokens on the other
     * network, otherwise it will be empty.
     */
    function bridgeSpecificActionsOnTokenTransfer(
        ERC677, /*_token*/
        address _from,
        uint256 _value,
        bytes _data
    ) internal {
        if (!lock()) {
            passMessage(_from, chooseReceiver(_from, _data), _value);
        }
    }

    /**
     * @dev Tells the address of the mediator contract on the other side, used by chooseReceiver method
     * to avoid sending the native tokens to that address.
     * @return address of the mediator contract con the other side
     */
    function bridgeContractOnOtherSide() internal view returns (address) {
        return mediatorContractOnOtherSide();
    }

    /**
     * @dev Sets the updated token balance of the contract.
     * @param _balance the new token balance of the contract.
     */
    function _setMediatorBalance(uint256 _balance) internal {
        uintStorage[MEDIATOR_BALANCE] = _balance;
    }
}
