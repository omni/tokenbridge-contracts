pragma solidity 0.4.24;

import "./BasicAMBNativeToErc20.sol";
import "../BaseERC677Bridge.sol";
import "../../interfaces/IBurnableMintableERC677Token.sol";
import "../ReentrancyGuard.sol";

/**
* @title ForeignAMBNativeToErc20
* @dev Foreign mediator implementation for native-to-erc20 bridge intended to work on top of AMB bridge.
* It is design to be used as implementation contract of EternalStorageProxy contract.
*/
contract ForeignAMBNativeToErc20 is BasicAMBNativeToErc20, ReentrancyGuard, BaseERC677Bridge {
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
        address _erc677token,
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
        setErc677token(_erc677token);
        setInitialize();
        return isInitialized();
    }

    /**
    * @dev Public getter for token contract.
    * @return address of the used token contract
    */
    function erc677token() public view returns (ERC677) {
        return _erc677token();
    }

    /**
    * @dev Mint the amount of tokens that were bridged from the other network.
    * If configured, it calculates, subtract and distribute the fees among the reward accounts.
    * @param _receiver address that will receive the tokens
    * @param _value amount of tokens to be received
    */
    function executeActionOnBridgedTokens(address _receiver, uint256 _value) internal {
        uint256 valueToMint = _unshiftValue(_value);

        bytes32 _messageId = messageId();
        IMediatorFeeManager feeManager = feeManagerContract();
        if (feeManager != address(0)) {
            uint256 fee = feeManager.calculateFee(valueToMint);
            if (fee != 0) {
                distributeFee(feeManager, fee, _messageId);
                valueToMint = valueToMint.sub(fee);
            }
        }

        IBurnableMintableERC677Token(erc677token()).mint(_receiver, valueToMint);
        emit TokensBridged(_receiver, valueToMint, _messageId);
    }

    /**
    * @dev Mint back the amount of tokens that were bridged to the other network but failed.
    * @param _receiver address that will receive the tokens
    * @param _value amount of tokens to be received
    */
    function executeActionOnFixedTokens(address _receiver, uint256 _value) internal {
        IBurnableMintableERC677Token(erc677token()).mint(_receiver, _value);
    }

    /**
    * @dev It will initiate the bridge operation that will burn the amount of tokens transferred and unlock the native tokens on
    * the other network. The user should first call Approve method of the ERC677 token.
    * @param _receiver address that will receive the native tokens on the other network.
    * @param _value amount of tokens to be transferred to the other network.
    */
    function relayTokens(address _receiver, uint256 _value) external {
        // This lock is to prevent calling passMessage twice.
        // When transferFrom is called, after the transfer, the ERC677 token will call onTokenTransfer from this contract
        // which will call passMessage.
        require(!lock());
        ERC677 token = erc677token();
        address to = address(this);
        require(withinLimit(_value));
        addTotalSpentPerDay(getCurrentDay(), _value);

        setLock(true);
        token.transferFrom(msg.sender, to, _value);
        setLock(false);
        bridgeSpecificActionsOnTokenTransfer(token, msg.sender, _value, abi.encodePacked(_receiver));
    }

    /**
    * @dev This method is called when transferAndCall is used from ERC677 to transfer the tokens to this contract.
    * It will initiate the bridge operation that will burn the amount of tokens transferred and unlock the native tokens on
    * the other network.
    * @param _from address that transferred the tokens.
    * @param _value amount of tokens transferred.
    * @param _data this parameter could contain the address of an alternative receiver of the tokens on the other network,
    * otherwise it will be empty.
    */
    function onTokenTransfer(address _from, uint256 _value, bytes _data) external returns (bool) {
        ERC677 token = erc677token();
        require(msg.sender == address(token));
        if (!lock()) {
            require(withinLimit(_value));
            addTotalSpentPerDay(getCurrentDay(), _value);
        }
        bridgeSpecificActionsOnTokenTransfer(token, _from, _value, _data);
        return true;
    }

    /**
    * @dev Burns the amount of tokens and makes the request to unlock the native tokens on the other network.
    * @param _token address of the ERC677 token.
    * @param _from address that transferred the tokens.
    * @param _value amount of tokens transferred.
    * @param _data this parameter could contain the address of an alternative receiver of the native tokens on the other
    * network, otherwise it will be empty.
    */
    function bridgeSpecificActionsOnTokenTransfer(ERC677 _token, address _from, uint256 _value, bytes _data) internal {
        if (!lock()) {
            IBurnableMintableERC677Token(_token).burn(_value);
            passMessage(_from, chooseReceiver(_from, _data), _value);
        }
    }

    /**
    * @dev Mint the fee amount of tokens to the fee manager contract.
    * @param _feeManager address that will receive the minted tokens.
    * @param _fee amount of tokens to be minted.
    */
    function onFeeDistribution(address _feeManager, uint256 _fee) internal {
        IBurnableMintableERC677Token(erc677token()).mint(_feeManager, _fee);
    }

    /**
    * @dev Allows to transfer any locked token on this contract that is not part of the bridge operations.
    * @param _token address of the token, if it is not provided, native tokens will be transferred.
    * @param _to address that will receive the locked tokens on this contract.
    */
    function claimTokens(address _token, address _to) external onlyIfUpgradeabilityOwner {
        // For foreign side of the bridge, tokens are not locked at the contract, they are minted and burned instead.
        // So, its is safe to allow claiming of any tokens. Native coins are allowed as well.
        claimValues(_token, _to);
    }

    /**
    * @dev Allows to transfer any locked token on the ERC677 token contract.
    * @param _token address of the token, if it is not provided, native tokens will be transferred.
    * @param _to address that will receive the locked tokens on this contract.
    */
    function claimTokensFromErc677(address _token, address _to) external onlyIfUpgradeabilityOwner {
        IBurnableMintableERC677Token(erc677token()).claimTokens(_token, _to);
    }

    /**
    * @dev Tells the address of the mediator contract on the other side, used by chooseReceiver method
    * to avoid sending the native tokens to that address.
    * @return address of the mediator contract con the other side
    */
    function bridgeContractOnOtherSide() internal view returns (address) {
        return mediatorContractOnOtherSide();
    }
}
