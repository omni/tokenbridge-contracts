pragma solidity 0.4.24;

import "./HomeBridgeNativeToErc.sol";

contract ClassicHomeBridgeNativeToErc is HomeBridgeNativeToErc {
    function _initialize(
        address _validatorContract,
        uint256[] _dailyLimitMaxPerTxMinPerTxArray, // [ 0 = _dailyLimit, 1 = _maxPerTx, 2 = _minPerTx ]
        uint256 _homeGasPrice,
        uint256 _requiredBlockConfirmations,
        uint256[] _foreignDailyLimitForeignMaxPerTxArray, // [ 0 = _foreignDailyLimit, 1 = _foreignMaxPerTx ]
        address _owner,
        uint256 _decimalShift
    ) internal {
        super._initialize(
            _validatorContract,
            _dailyLimitMaxPerTxMinPerTxArray,
            _homeGasPrice,
            _requiredBlockConfirmations,
            _foreignDailyLimitForeignMaxPerTxArray,
            _owner,
            _decimalShift
        );
        uintStorage[keccak256(abi.encodePacked("dataSizes", bytes4(keccak256("signature(bytes32,uint256)"))))] = 132;
        uintStorage[keccak256(abi.encodePacked("dataSizes", bytes4(keccak256("message(bytes32)"))))] = 210;
    }
}
