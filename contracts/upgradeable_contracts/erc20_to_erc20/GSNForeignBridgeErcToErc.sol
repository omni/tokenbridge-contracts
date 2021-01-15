pragma solidity 0.4.24;

import "./BasicForeignBridgeErcToErc.sol";
import "../ERC20Bridge.sol";
import "../../gsn/BaseRelayRecipient.sol";

contract GSNForeignBridgeErcToErc is BasicForeignBridgeErcToErc, ERC20Bridge, BaseRelayRecipient {
    bytes32 internal constant PAYMASTER = 0xfefcc139ed357999ed60c6a013947328d52e7d9751e93fd0274a2bfae5cbcb12; // keccak256(abi.encodePacked("paymaster"))

    function versionRecipient() external view returns (string memory) {
        return "1.0.1";
    }

    function setTrustedForwarder(address _trustedForwarder) public onlyOwner {
        trustedForwarder = _trustedForwarder;
    }

    function setPayMaster(address _paymaster) public onlyOwner {
        addressStorage[PAYMASTER] = _paymaster;
    }

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

            addTotalExecutedPerDay(getCurrentDay(), amount);

            // Send maxTokensFee to paymaster
            uint256 unshiftMaxFee = _unshiftValue(maxTokensFee);
            require(erc20token().transfer(addressStorage[PAYMASTER], unshiftMaxFee), "paymaster tranfer failed");

            uint256 unshiftLeft = _unshiftValue(amount - maxTokensFee);
            require(erc20token().transfer(recipient, unshiftLeft), "end user tranfer failed");

            emit RelayedMessage(recipient, amount, txHash);
        } else {
            onFailedMessage(recipient, amount, txHash);
        }
    }
}
