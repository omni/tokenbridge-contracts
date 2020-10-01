pragma solidity 0.4.24;

import "../libraries/ArbitraryMessage.sol";

contract MessageTest {
    function unpackHeader(bytes _data)
        external
        pure
        returns (
            bytes32 messageId,
            address sender,
            address executor,
            uint32 gasLimit,
            bytes1 dataType,
            uint256[2] chainIds,
            uint256 gasPrice,
            uint256 offset
        )
    {
        (messageId, sender, executor, gasLimit, dataType, chainIds, gasPrice, offset) = ArbitraryMessage.unpackHeader(
            _data
        );
    }

    function unpackPayload(bytes _data, uint256 _offset) external pure returns (bytes memory) {
        return ArbitraryMessage.unpackPayload(_data, _offset);
    }
}
