pragma solidity 0.4.24;

import "../BasicForeignBridge.sol";
import "openzeppelin-solidity/contracts/token/ERC20/ERC20Basic.sol";

contract BasicForeignBridgeErcToErc is BasicForeignBridge {
    function _initialize(
        address _validatorContract,
        address _erc20token,
        uint256 _requiredBlockConfirmations,
        uint256 _gasPrice,
        uint256 _maxPerTx,
        uint256 _homeDailyLimit,
        uint256 _homeMaxPerTx,
        address _owner
    ) internal {
        require(!isInitialized());
        require(AddressUtils.isContract(_validatorContract));
        require(_requiredBlockConfirmations != 0);
        require(_gasPrice > 0);
        require(_homeMaxPerTx < _homeDailyLimit);
        require(_owner != address(0));
        addressStorage[keccak256(abi.encodePacked("validatorContract"))] = _validatorContract;
        setErc20token(_erc20token);
        uintStorage[DEPLOYED_AT_BLOCK] = block.number;
        uintStorage[REQUIRED_BLOCK_CONFIRMATIONS] = _requiredBlockConfirmations;
        uintStorage[GAS_PRICE] = _gasPrice;
        uintStorage[MAX_PER_TX] = _maxPerTx;
        uintStorage[EXECUTION_DAILY_LIMIT] = _homeDailyLimit;
        uintStorage[EXECUTION_MAX_PER_TX] = _homeMaxPerTx;
        setOwner(_owner);
        setInitialize();
    }

    function getBridgeMode() external pure returns (bytes4 _data) {
        return bytes4(keccak256(abi.encodePacked("erc-to-erc-core")));
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
        setTotalExecutedPerDay(getCurrentDay(), totalExecutedPerDay(getCurrentDay()).add(_amount));
        return erc20token().transfer(_recipient, _amount);
    }

    function onFailedMessage(address, uint256, bytes32) internal {
        revert();
    }

    /* solcov ignore next */
    function erc20token() public view returns (ERC20Basic);

    /* solcov ignore next */
    function setErc20token(address _token) internal;
}
