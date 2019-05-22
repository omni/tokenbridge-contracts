pragma solidity 0.4.24;

import "./HomeBridgeNativeToErc.sol";


contract ClassicHomeBridgeNativeToErc is HomeBridgeNativeToErc {

    function _initialize (
        address _validatorContract,
        uint256 _dailyLimit,
        uint256 _maxPerTx,
        uint256 _minPerTx,
        uint256 _homeGasPrice,
        uint256 _requiredBlockConfirmations,
        uint256 _foreignDailyLimit,
        uint256 _foreignMaxPerTx,
        address _owner
    ) internal
    {
        super._initialize(
            _validatorContract,
            _dailyLimit,
            _maxPerTx,
            _minPerTx,
            _homeGasPrice,
            _requiredBlockConfirmations,
            _foreignDailyLimit,
            _foreignMaxPerTx,
            _owner
        );
        uintStorage[keccak256(abi.encodePacked("dataSizes", bytes4(keccak256("signature(bytes32,uint256)"))))] = 132;
        uintStorage[keccak256(abi.encodePacked("dataSizes", bytes4(keccak256("message(bytes32)"))))] = 210;
    }
}
