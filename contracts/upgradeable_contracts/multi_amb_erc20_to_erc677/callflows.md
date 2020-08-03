# MULTI-AMB-ERC20-TO-ERC677 extension call flows

The call flows below document sequences of contracts methods invocations to cover the main MULTI-AMB-ERC20-TO-ERC677 extension operations.

## Tokens relay: successful path

### Sending ERC20 tokens from Foreign to Home

The scenario to pass ERC20 tokens to another side of the bridge in form of ERC677 compatible tokens locks the tokens on the mediator contract on originating (Foreign) bridge side. On the first operation with some particular ERC20 token, a new ERC677 token contract is deployed on the terminating (Home) bridge side. Then the mediator on the terminating (Home) bridge side mints some amount of ERC677 tokens.

#### Request

In order to initiate the request the ERC20 tokens can be sent using two different ways:
- If the token support ERC677 standard, using one tx with `transfer` or `transferAndCall` functions.
- Using two transactions: first call `approve` on the token contract, then call any overload of `relayTokens` function.

It is necessary to note that the mediator on the originating side could be configured to use a fee manager. If so, the amount of minted tokens on the terminating side will be less than the actual locked amount. Collected fee amount will be distributed between configured reward receivers.

First transfer of any ERC20 token:
```=
>>Mediator
ForeignMultiAMBErc20ToErc677::onTokenTransfer/relayTokens
..ForeignMultiAMBErc20ToErc677::bridgeSpecificActionsOnTokenTransfer
....TokenReader::readName
....TokenReader::readSymbol
....TokenReader::readDecimals
....BasicMultiTokenBridge::_initializeTokenBridgeLimits
....ForeignFeeManagerMultiAMBErc20ToErc677::_setFee
....ForeignFeeManagerMultiAMBErc20ToErc677::_setFee
....ForeignFeeManagerMultiAMBErc20ToErc677::_distributeFee
....ForeignMultiAMBErc20ToErc677::_setMediatorBalance
....MultiTokenBridgeMediator::setMessageToken
....TransferInfoStorage::setMessageValue
....TransferInfoStorage::setMessageRecipient
....ForeignMultiAMBErc20ToErc677::_setTokenRegistrationMessageId
>>Bridge
....MessageDelivery::requireToPassMessage
......ForeignAMB::emitEventOnMessageRequest
........emit UserRequestForAffirmation
```

Subsequent ERC20 transfers:
```=
>>Mediator
ForeignMultiAMBErc20ToErc677::onTokenTransfer/relayTokens
..ForeignMultiAMBErc20ToErc677::bridgeSpecificActionsOnTokenTransfer
....ForeignFeeManagerMultiAMBErc20ToErc677::_distributeFee
....ForeignMultiAMBErc20ToErc677::_setMediatorBalance
....MultiTokenBridgeMediator::setMessageToken
....TransferInfoStorage::setMessageValue
....TransferInfoStorage::setMessageRecipient
>>Bridge
....MessageDelivery::requireToPassMessage
......ForeignAMB::emitEventOnMessageRequest
........emit UserRequestForAffirmation
```

#### Execution

First transfer of any ERC20 token:
```=
>>Bridge
BasicHomeAMB::executeAffirmation
..BasicHomeAMB::handleMessage
....ArbitraryMessage::unpackData
....MessageProcessor::processMessage
......MessageProcessor::_passMessage
........MessageProcessor::setMessageSender
........MessageProcessor::setMessageId
>>Mediator
........HomeMultiAMBErc20ToErc677::deployAndHandleBridgedTokens
..........new TokenProxy;
..........HomeMultiAMBErc20ToErc677::_setTokenAddressPair
..........BasicMultiTokenBridge::_initializeTokenBridgeLimits
............emit NewTokenRegistered
..........MultiTokenBridgeMediator::_handleBridgedTokens
............HomeMultiAMBErc20ToErc677::executeActionOnBridgedTokens
..............ERC677BridgeToken::mint
................<######>
..............emit TokensBridged
>>Bridge
......MessageProcessor::setMessageCallStatus
......HomeAMB::emitEventOnMessageProcessed
........emit AffirmationCompleted
```

Subsequent ERC20 transfers:
```=
>>Bridge
BasicHomeAMB::executeAffirmation
..BasicHomeAMB::handleMessage
....ArbitraryMessage::unpackData
....MessageProcessor::processMessage
......MessageProcessor::_passMessage
........MessageProcessor::setMessageSender
........MessageProcessor::setMessageId
>>Mediator
........HomeMultiAMBErc20ToErc677::handleBridgedTokens
..........HomeMultiAMBErc20ToErc677::homeTokenAddress
..........MultiTokenBridgeMediator::_handleBridgedTokens
............HomeMultiAMBErc20ToErc677::executeActionOnBridgedTokens
..............ERC677BridgeToken::mint
................<######>
..............emit TokensBridged
>>Bridge
......MessageProcessor::setMessageCallStatus
......HomeAMB::emitEventOnMessageProcessed
........emit AffirmationCompleted
```

### Sending ERC677 tokens from Home to Foreign

For the scenario to exchange ERC677 tokens back to the locked ERC20 ones, the mediator contract on the originating (Home) bridge side burns the tokens. The mediator of the terminating bridge side unlocks the ERC20 tokens in favor of the originating request sender.

It is necessary to note that the mediator on the terminating side could be configured to use a fee manager. If so, the amount of unlocked tokens on the terminating side will be less than the actual burned amount. Collected fee amount will be distributed between configured reward receivers.

#### Request

Since the token contract is ERC677 compatible, the `transferAndCall` method is used to initiate the exchange from ERC677 tokens to ERC20 tokens. However, the way of first approving tokens and then calling `relayTokens` also works.

```=
>>Token
ERC677BridgeToken::transferAndCall
..ERC677BridgeToken::superTransfer
....BasicToken::transfer
......emit Transfer
..emit Transfer
..ERC677BridgeToken::contractFallback
>>Mediator
....HomeMultiAMBErc20ToErc677::onTokenTransfer/relayTokens
......HomeMultiAMBErc20ToErc677::bridgeSpecificActionsOnTokenTransfer
>>Token
........BurnableToken::burn
..........BurnableToken::_burn
>>Mediator
........TokenBridgeMediator::passMessage
..........HomeMultiAMBErc20ToErc677::foreignTokenAddress
..........MultiTokenBridgeMediator::setMessageToken
..........TransferInfoStorage::setMessageValue
..........TransferInfoStorage::setMessageRecipient
>>Bridge
..........MessageDelivery::requireToPassMessage
............HomeAMB::emitEventOnMessageRequest
..............emit UserRequestForSignature
```

#### Execution

If it is configured, the fee manager is involved to calculate and distribute fees: the mediators receives the request to unlock tokens from the AMB contract, calculates the fees amount by using the fee manager, distributes calculated fee among the accounts configured in the fee manager. The fee manager safely sends fractions of the fees to the accounts. As soon as this process finishes the mediator contract sends the reduced amount of ERC20 tokens to the initial request sender's address.

```=
>>Bridge
BasicForeignAMB::executeSignatures
..ArbitraryMessage.unpackData
....MessageProcessor::processMessage
......MessageProcessor::_passMessage
........MessageProcessor::setMessageSender
........MessageProcessor::setMessageId
>>Mediator
........ForeignMultiAMBErc20ToErc677::handleBridgedTokens
..........MultiTokenBridgeMediator::_handleBridgedTokens
............ForeignMultiAMBErc20ToErc677::executeActionOnBridgedTokens
..............ForeignFeeManagerMultiAMBErc20ToErc677::_distributeFee
..............ForeignMultiAMBErc20ToErc677::_setMediatorBalance
>>Token
................ERC20::transfer
>>Mediator
..............emit TokensBridged
>>Bridge
......MessageProcessor::setMessageCallStatus
......ForeignAMB::emitEventOnMessageProcessed
........emit RelayedMessage
```

## Tokens relay: failure and recovery

Failures in the mediator contract at the moment to complete a relay operation could cause imbalance of the extension due to the asynchronous nature of the Arbitrary Message Bridge. Therefore the feature to recover the balance of the MULTI-AMB-ERC20-TO-ERC677 extension is very important for the extension healthiness. 

For the mediator contracts there is a possibility to provide a way how to recover an operation if the data relay request has been failed within the mediator contract on another side.

For the token bridging this means that:
  * if the operation to mint tokens as part of the Foreign->Home request processing was failed, it is possible to unlock the tokens on the Foreign side;
  * if the operation to unlock tokens as part of the Home->Foreign request processing was failed, it is possible to mint the burnt tokens on the Home side.

The mediator can get the status of the corresponding relay request from the bridge contract by using the id of this request (AMB message id). So, as soon as a user would like to perform a recovery they send a call with the request id to the mediator contract and if such request was failed indeed, the mediator originates the recovery message to the mediator on another side. The recovery messages contain the same information as it was used by the tokens relay request, so the terminating mediator checks that such request was registered and executes the actual recovery by using amount of tokens from the request and the request sender.

It is important that the recovery must be performed without the extension admin attendance.

### Failed attempt to relay tokens from Home to Foreign

#### Execution Failure

A failure happens within the message handler on the mediator contract's side when the Foreign bridge contract passes the message to it.

```=
>>Bridge
BasicForeignAMB::executeSignatures
..ArbitraryMessage.unpackData
....MessageProcessor::processMessage
......MessageProcessor::_passMessage
........MessageProcessor::setMessageSender
........MessageProcessor::setMessageId
>>Mediator
........[failed ForeignMultiAMBErc20ToErc677::handleBridgedTokens]
>>Bridge
......MessageProcessor::setMessageCallStatus
......MessageProcessor::setFailedMessageReceiver
......MessageProcessor::setFailedMessageSender
......ForeignAMB::emitEventOnMessageProcessed
........emit RelayedMessage
```

#### Recovery initialization

As soon as a user identified a message transfer failure (e.g. the corresponding amount of ERC677 tokens did not appear on the user account balance on the Foreign chain), they call the `requestFailedMessageFix` method on the Foreign mediator contract. Anyone is able to call this method by specifying the message id. The method requests the bridge contract whether the corresponding message was failed indeed. That is why the operation is safe to perform by anyone.

```=
>>Mediator
MultiTokenBridgeMediator::requestFailedMessageFix
>>Bridge
..MessageProcessor::messageCallStatus
..MessageProcessor::failedMessageReceiver
..MessageProcessor::failedMessageSender
..MessageDelivery::requireToPassMessage
....ForeignAMB::emitEventOnMessageRequest
......emit UserRequestForAffirmation
```

#### Recovery completion

The Home chain initially originated the request, that is why the extension is imbalances - more ERC20 tokens are locked on the Foreign side than ERC677 tokens are minted on the Home side. Therefore the appeared message to invoke `fixFailedMessage` causes minting of the ERC677 tokens.

```=
>>Bridge
BasicHomeAMB::executeAffirmation
..BasicHomeAMB::handleMessage
....ArbitraryMessage::unpackData
....MessageProcessor::processMessage
......MessageProcessor::_passMessage
........MessageProcessor::setMessageSender
........MessageProcessor::setMessageId
>>Mediator
........MultiTokenBridgeMediator::fixFailedMessage
..........MultiTokenBridgeMediator::messageToken
..........MultiTokenBridgeMediator::messageRecipient
..........MultiTokenBridgeMediator::messageValue
..........MultiTokenBridgeMediator::setMessageFixed
..........HomeMultiAMBErc20ToErc677::executeActionOnFixedTokens
............ERC677BridgeToken::mint
..............<######>
..........emit FailedMessageFixed
>>Bridge
......MessageProcessor::setMessageCallStatus
......HomeAMB::emitEventOnMessageProcessed
........emit AffirmationCompleted
```

### Failed attempt to relay tokens from Foreign to Home

#### Execution Failure

A failure happens within the message handler on the mediator contract's side when the Home bridge contract passes the message to it.

```=
>>Bridge
BasicHomeAMB::executeAffirmation
..BasicHomeAMB::handleMessage
....ArbitraryMessage::unpackData
....MessageProcessor::processMessage
......MessageProcessor::_passMessage
........MessageProcessor::setMessageSender
........MessageProcessor::setMessageId
>>Mediator
........[failed HomeMultiAMBErc20ToErc677::handleBridgedTokens/deployAndHandleBridgedTokens]
>>Bridge
......MessageProcessor::setMessageCallStatus
......MessageProcessor::setFailedMessageReceiver
......MessageProcessor::setFailedMessageSender
......HomeAMB::emitEventOnMessageProcessed
........emit AffirmationCompleted
```

#### Recovery initialization

As soon as a user identified a message transfer failure (e.g. the corresponding amount of ERC677 tokens did not appear on the user account balance on the Home chain), they call the `requestFailedMessageFix` method on the Home mediator contract. Anyone is able to call this method by specifying the message id. The method requests the bridge contract whether the corresponding message was failed indeed. That is why the operation is safe to perform by anyone.

```=
>>Mediator
MultiTokenBridgeMediator::requestFailedMessageFix
>>Bridge
..MessageProcessor::messageCallStatus
..MessageProcessor::failedMessageReceiver
..MessageProcessor::failedMessageSender
..MessageDelivery::requireToPassMessage
....HomeAMB::emitEventOnMessageRequest
......emit UserRequestForSignature
```

#### Recovery completion

The Foreign chain initially originated the request. It has locked ERC20 that cause the extension to be imbalanced. That is why the appeared message to invoke `fixFailedMessage` causes the unlock of some ERC20 token.

```=
>>Bridge
BasicForeignAMB::executeSignatures
..ArbitraryMessage.unpackData
....MessageProcessor::processMessage
......MessageProcessor::_passMessage
........MessageProcessor::setMessageSender
........MessageProcessor::setMessageId
>>Mediator
........HomeMultiAMBErc20ToErc677::fixFailedMessage
..........MultiTokenBridgeMediator::fixFailedMessage
............MultiTokenBridgeMediator::messageToken
............MultiTokenBridgeMediator::messageRecipient
............MultiTokenBridgeMediator::messageValue
............ForeignMultiAMBErc20ToErc677::executeActionOnFixedTokens
............ForeignMultiAMBErc20ToErc677::tokenRegistrationMessageId
............[ForeignMultiAMBErc20ToErc677::_setTokenRegistrationMessageId]
>>Token
..............ERC20::transfer
>>Mediator
............emit FailedMessageFixed
>>Bridge
......MessageProcessor::setMessageCallStatus
......ForeignAMB::emitEventOnMessageProcessed
........emit RelayedMessage
```

## Tokens relay to an alternative receiver

The idea of the feature is that a user invokes a special method (`relayTokens`) on the mediator contract in order to specify the receiver of the tokens on the another side. So, the tokens will be unlocked/minted in favor of specified account rather than the request originator as it is assumed by the general approach. 

Also, the alternative receiver can be specified using data field when using `transferAndCall`. All deployed tokens on the Home side has a support of `transferAndCall` function. Existing tokens on the Foreign side might also have such support, please check the implementation of the specific token.
