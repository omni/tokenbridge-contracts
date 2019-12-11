pragma solidity 0.4.24;

import "../BasicForeignBridge.sol";
import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";

contract BasicForeignBridgeErcToErc is BasicForeignBridge {
    function initialize(
        address _validatorContract,
        address _erc20token,
        uint256 _requiredBlockConfirmations,
        uint256 _gasPrice,
        // [ 0 = _dailyLimit, 1 = _maxPerTx, 2 = _minPerTx ]
        uint256[] _requestLimitsArray,
        // absolute: [ 0 = _executionDailyLimit, 1 = _executionMaxPerTx, 2 = _executionMinPerTx ]
        // relative: [ 0 = _targetLimit, 1 = _threshold, 2 = _executionMaxPerTx, 3 = _executionMinPerTx ]
        uint256[] _executionLimitsArray,
        address _owner,
        uint256 _decimalShift,
        address _limitsContract
    ) external returns (bool) {
        require(!isInitialized());
        require(AddressUtils.isContract(_validatorContract));
        require(_requiredBlockConfirmations != 0);
        require(_gasPrice > 0);
        require(_owner != address(0));
        require(AddressUtils.isContract(_limitsContract));

        addressStorage[VALIDATOR_CONTRACT] = _validatorContract;
        setErc20token(_erc20token);
        uintStorage[DEPLOYED_AT_BLOCK] = block.number;
        uintStorage[REQUIRED_BLOCK_CONFIRMATIONS] = _requiredBlockConfirmations;
        uintStorage[GAS_PRICE] = _gasPrice;
        uintStorage[DECIMAL_SHIFT] = _decimalShift;
        setOwner(_owner);
        addressStorage[LIMITS_CONTRACT] = _limitsContract;
        setLimits(_requestLimitsArray, _executionLimitsArray);

        emit RequiredBlockConfirmationChanged(_requiredBlockConfirmations);
        emit GasPriceChanged(_gasPrice);

        setInitialize();
        return isInitialized();
    }

    function getBridgeMode() external pure returns (bytes4 _data) {
        return 0xba4690f5; // bytes4(keccak256(abi.encodePacked("erc-to-erc-core")))
    }

    function claimTokens(address _token, address _to) public {
        require(_token != address(erc20token()));
        super.claimTokens(_token, _to);
    }

    function onExecuteMessage(
        address _recipient,
        uint256 _amount,
        bytes32 /*_txHash*/
    ) internal returns (bool) {
        _increaseTotalExecutedPerDay(_amount);
        uint256 amount = _amount.div(10**decimalShift());
        return erc20token().transfer(_recipient, amount);
    }

    function onFailedMessage(address, uint256, bytes32) internal {
        revert();
    }

    function _getTokenBalance() internal view returns (uint256) {
        return erc20token().balanceOf(address(this));
    }

    /* solcov ignore next */
    function erc20token() public view returns (ERC20);

    /* solcov ignore next */
    function setErc20token(address _token) internal;
}
