pragma solidity 0.4.24;

import "../libraries/ArbitraryMessage.sol";

contract MessageTest {
    function unpackData(bytes _data)
        public
        pure
        returns (
            bytes32 messageId,
            address sender,
            address executor,
            uint32 gasLimit,
            bytes1 dataType,
            uint256[2] chainIds,
            uint256 gasPrice,
            bytes memory data
        )
    {
        (messageId, sender, executor, gasLimit, dataType, chainIds, gasPrice, data) = ArbitraryMessage.unpackData(
            _data
        );
    }

    function unpackDataWithExtraParams(
        bytes _data,
        bytes /*signatures*/
    )
        public
        pure
        returns (
            bytes32 messageId,
            address sender,
            address executor,
            uint32 gasLimit,
            bytes1 dataType,
            uint256[2] chainIds,
            uint256 gasPrice,
            bytes memory data
        )
    {
        (messageId, sender, executor, gasLimit, dataType, chainIds, gasPrice, data) = ArbitraryMessage.unpackData(
            _data
        );
    }

}
