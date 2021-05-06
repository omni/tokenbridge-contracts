// SPDX-License-Identifier:MIT
pragma solidity 0.4.24;

import "../forwarder/IForwarder.sol";

contract GsnTypes {
    struct RelayData {
        uint256 gasPrice;
        uint256 pctRelayFee;
        uint256 baseRelayFee;
        address relayWorker;
        address paymaster;
        bytes paymasterData;
        uint256 clientId;
        address forwarder;
    }

    //note: must start with the ForwardRequest to be an extension of the generic forwarder
    struct RelayRequest {
        IForwarder.ForwardRequest request;
        RelayData relayData;
    }
}
