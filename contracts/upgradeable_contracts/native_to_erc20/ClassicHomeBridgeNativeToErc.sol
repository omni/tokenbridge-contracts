pragma solidity 0.4.24;

import "./HomeBridgeNativeToErc.sol";

contract ClassicHomeBridgeNativeToErc is HomeBridgeNativeToErc {
    function _initialize(
        address _validatorContract,
        uint256[3] _dailyLimitMaxPerTxMinPerTxArray, // [ 0 = _dailyLimit, 1 = _maxPerTx, 2 = _minPerTx ]
        uint256 _homeGasPrice,
        uint256 _requiredBlockConfirmations,
        uint256[2] _foreignDailyLimitForeignMaxPerTxArray, // [ 0 = _foreignDailyLimit, 1 = _foreignMaxPerTx ]
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
        uintStorage[0x5e16d82565fc7ee8775cc18db290ff4010745d3fd46274a7bc7ddbebb727fa54] = 132; // keccak256(abi.encodePacked("dataSizes", bytes4(keccak256("signature(bytes32,uint256)"))))
        uintStorage[0x3b0a1ac531be1657049cf649eca2510ce9e3ef7df1be26d5c248fe8b298f4374] = 210; // keccak256(abi.encodePacked("dataSizes", bytes4(keccak256("message(bytes32)"))))
    }
}
