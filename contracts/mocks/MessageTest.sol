pragma solidity 0.4.24;

import "../libraries/ArbitraryMessage.sol";

contract MessageTest {
    function unpackData(bytes _data)
        public
        pure
        returns (
            address sender,
            address executor,
            bytes32 messageId,
            uint256 gasLimit,
            bytes1 dataType,
            uint256 gasPrice,
            bytes memory data
        )
    {
        (sender, executor, messageId, gasLimit, dataType, gasPrice, data) = ArbitraryMessage.unpackData(_data, false);
    }

    function unpackDataWithExtraParams(
        bytes _data,
        bytes /*signatures*/
    )
        public
        pure
        returns (
            address sender,
            address executor,
            bytes32 messageId,
            uint256 gasLimit,
            bytes1 dataType,
            uint256 gasPrice,
            bytes memory data
        )
    {
        (sender, executor, messageId, gasLimit, dataType, gasPrice, data) = ArbitraryMessage.unpackData(_data, true);
    }

}
