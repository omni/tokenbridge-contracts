pragma solidity 0.4.24;

import "../libraries/ArbitraryMessage.sol";


contract MessageTest {

    event UnpackedData(
        address sender,
        address executor,
        bytes32 txHash,
        uint256 gasLimit,
        bytes1 dataType,
        uint256 gasPrice,
        bytes data
    );

    function unpackData(bytes _data) public {
        address sender;
        address executor;
        bytes32 txHash;
        uint256 gasLimit;
        bytes1 dataType;
        uint256 gasPrice;
        bytes memory data;

        (sender, executor, txHash, gasLimit, dataType, gasPrice, data) = ArbitraryMessage.unpackData(_data);

        emit UnpackedData(sender, executor, txHash, gasLimit, dataType, gasPrice, data);
    }
}
