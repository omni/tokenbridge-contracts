pragma solidity 0.4.24;

import "../BasicForeignBridge.sol";
import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";

contract BasicForeignBridgeErcToErc is BasicForeignBridge {
    function _initialize(
        address _validatorContract,
        address _erc20token,
        uint256 _requiredBlockConfirmations,
        uint256 _gasPrice,
        uint256[3] _dailyLimitMaxPerTxMinPerTxArray, // [ 0 = _dailyLimit, 1 = _maxPerTx, 2 = _minPerTx ]
        uint256[2] _homeDailyLimitHomeMaxPerTxArray, // [ 0 = _homeDailyLimit, 1 = _homeMaxPerTx ]
        address _owner,
        int256 _decimalShift
    ) internal {
        require(!isInitialized());
        require(AddressUtils.isContract(_validatorContract));

        addressStorage[VALIDATOR_CONTRACT] = _validatorContract;
        setErc20token(_erc20token);
        uintStorage[DEPLOYED_AT_BLOCK] = block.number;
        _setRequiredBlockConfirmations(_requiredBlockConfirmations);
        _setGasPrice(_gasPrice);
        _setLimits(_dailyLimitMaxPerTxMinPerTxArray);
        _setExecutionLimits(_homeDailyLimitHomeMaxPerTxArray);
        _setDecimalShift(_decimalShift);
        _setOwner(_owner);
        setInitialize();
    }

    function getBridgeMode() external pure returns (bytes4 _data) {
        return 0xba4690f5; // bytes4(keccak256(abi.encodePacked("erc-to-erc-core")))
    }

    /**
     * @dev Withdraws the erc20 tokens or native coins from this contract. Bridged token cannot be withdrawn by this function.
     * @param _token address of the claimed token or address(0) for native coins.
     * @param _to address of the tokens/coins receiver.
     */
    function claimTokens(address _token, address _to) external onlyIfUpgradeabilityOwner {
        // Since bridged tokens are locked at this contract, it is not allowed to claim them with the use of claimTokens function
        require(_token != address(erc20token()));
        claimValues(_token, _to);
    }

    function onExecuteMessage(
        address _recipient,
        uint256 _amount,
        bytes32 /*_txHash*/
    ) internal returns (bool) {
        addTotalExecutedPerDay(getCurrentDay(), _amount);
        uint256 amount = _unshiftValue(_amount);
        return erc20token().transfer(_recipient, amount);
    }

    function onFailedMessage(address, uint256, bytes32) internal {
        revert();
    }

    /* solcov ignore next */
    function erc20token() public view returns (ERC20);

    /* solcov ignore next */
    function setErc20token(address _token) internal;
}
