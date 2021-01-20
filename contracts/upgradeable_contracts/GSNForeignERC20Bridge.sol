pragma solidity 0.4.24;

import "./BasicForeignBridge.sol";
import "./ERC20Bridge.sol";
import "../gsn/BaseRelayRecipient.sol";
import "../gsn/interfaces/IKnowForwarderAddress.sol";

contract GSNForeignERC20Bridge is BasicForeignBridge, ERC20Bridge, BaseRelayRecipient, IKnowForwarderAddress {
    bytes32 internal constant PAYMASTER = 0xfefcc139ed357999ed60c6a013947328d52e7d9751e93fd0274a2bfae5cbcb12; // keccak256(abi.encodePacked("paymaster"))
    bytes32 internal constant TRUSTED_FORWARDER = 0x222cb212229f0f9bcd249029717af6845ea3d3a84f22b54e5744ac25ef224c92; // keccak256(abi.encodePacked("trustedForwarder"))

    function versionRecipient() external view returns (string memory) {
        return "1.0.1";
    }

    function getTrustedForwarder() external view returns (address) {
        return addressStorage[TRUSTED_FORWARDER];
    }

    function setTrustedForwarder(address _trustedForwarder) public onlyOwner {
        addressStorage[TRUSTED_FORWARDER] = _trustedForwarder;
    }

    function isTrustedForwarder(address forwarder) public view returns (bool) {
        return forwarder == addressStorage[TRUSTED_FORWARDER];
    }

    function setPayMaster(address _paymaster) public onlyOwner {
        addressStorage[PAYMASTER] = _paymaster;
    }

    /**
    * @param message same as in `executeSignatures`
    * @param signatures same as in `executeSignatures`
    * @param maxTokensFee maximum amount of foreign tokens that user allows to take
    * as a commission
    */
    function executeSignaturesGSN(bytes message, bytes signatures, uint256 maxTokensFee) external {
        Message.hasEnoughValidSignatures(message, signatures, validatorContract(), false);

        address recipient;
        uint256 amount;
        bytes32 txHash;
        address contractAddress;
        (recipient, amount, txHash, contractAddress) = Message.parseMessage(message);
        if (withinExecutionLimit(amount)) {
            require(maxTokensFee <= amount);
            require(contractAddress == address(this));
            require(!relayedMessages(txHash));
            setRelayedMessages(txHash, true);
            require(onExecuteMessageGSN(recipient, amount, maxTokensFee));
            emit RelayedMessage(recipient, amount, txHash);
        } else {
            onFailedMessage(recipient, amount, txHash);
        }
    }

    function onExecuteMessageGSN(address recipient, uint256 amount, uint256 fee) internal returns (bool) {
        addTotalExecutedPerDay(getCurrentDay(), amount);
        // Send maxTokensFee to paymaster
        uint256 unshiftMaxFee = _unshiftValue(fee);
        bool first = erc20token().transfer(addressStorage[PAYMASTER], unshiftMaxFee);

        // Send rest of tokens to user
        uint256 unshiftLeft = _unshiftValue(amount - fee);
        bool second = erc20token().transfer(recipient, unshiftLeft);

        return first && second;
    }
}
