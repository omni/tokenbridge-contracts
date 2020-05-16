# native-to-ERC677 AMB extension call flows

## Tokens relay: successful path

### Home to Foreign

The scenario to pass native tokens to another side of the bridge in form of ERC677-compatible tokens locks the native tokens on the mediator contract on originating (Home) bridge side. Then the mediator on the terminating (Foreign) bridge side mints some amount of ERC677 tokens.

It is necessary to note that the mediator on the terminating side could be configured to use a fee manager. If so, as soon as the mediator contract receives the passed request to mint tokens from the AMB contract, it asks the fee manager to calculate amount of fee, mints this amount of tokens in favor of the fee manage contract and initiates distribution of the fees among the fees recipients configured in the fee manager. The distribution process is to transfer a fraction of fee by using the ERC677 token contract for the corresponding recipient. When the fee is distributed, the amount of ERC677 tokens reduced by the fee amount will be minted for the address which originated the initial request on the Home chain.

#### Request

```=
>>Mediator
HomeAMBNativeToErc20::()
..HomeAMBNativeToErc20::nativeTransfer
....TokenBridgeMediator::passMessage
......TokenBridgeMediator::setMessageHashValue
......TokenBridgeMediator::setMessageHashRecipient
......TokenBridgeMediator::setNonce
>>Bridge
......MessageDelivery::requireToPassMessage
........HomeAMB::emitEventOnMessageRequest
..........emit UserRequestForSignature
```

#### Execution

```=
>>Bridge
BasicForeignAMB::executeSignatures
..ArbitraryMessage.unpackData
....MessageProcessor::processMessage
......MessageProcessor::_passMessage
........MessageProcessor::setMessageSender
........MessageProcessor::setTransactionHash
>>Mediator
........TokenBridgeMediator::handleBridgedTokens
..........ForeignAMBNativeToErc20::executeActionOnBridgedTokens
............ForeignAMBNativeToErc20::distributeFee
..............MediatorMessagesGuard::enableMessagesRestriction
..............RewardableMediator::distributeFee
................ForeignAMBNativeToErc20::onFeeDistribution
>>Token
..................MintableToken::mint
>>Fee Manager
................BaseMediatorFeeManager::onTokenTransfer
..................BaseMediatorFeeManager::distributeFee
....................ForeignFeeManagerAMBNativeToErc20::onFeeDistribution
>>Token
......................ERC677BridgeToken::transfer
........................ERC677BridgeToken::superTransfer
..........................BasicToken::transfer
........................ERC677BridgeToken::callAfterTransfer
..........................ERC677BridgeToken::contractFallback
............................<TOKENRECEIVER>::onTokenTransfer
..............................<######>
>>Mediator
..............MediatorMessagesGuard::disableMessagesRestriction
>>Token
............MintableToken::mint
>>Mediator
............emit TokensBridged
>>Bridge
......MessageProcessor::setMessageCallStatus
......ForeignAMB::emitEventOnMessageProcessed
........emit RelayedMessage
```

### Foreign to Home

For the scenario to exchange ERC677-tokens back to the native ones the mediator contract on the originating (Foreign) bridge side burns the tokens. The mediator of the terminating bride side unlocks the native tokens in favor of the originating request sender.

If it is configured the fee manager is involved to calculate and distribute fees: the mediators receives the request to unlock tokens from the AMB contract, calculates the fees amount by using the fee manager, sends this amount of tokens to the fee manager and passes the control to it for the fees distribution among the accounts configured in the fee manager. The fee manager safely sends fractions of the fees to the accounts. As soon as this process finishes the mediator contract sends the reduced amount of native tokens to the initial request sender's address.

#### Request

```=
>>Token
ERC677BridgeToken::transferAndCall
..ERC677BridgeToken::superTransfer
....BasicToken::transfer
......emit Transfer
..emit Transfer
..ERC677BridgeToken::contractFallback
>>Mediator
....ForeignAMBNativeToErc20::onTokenTransfer
......MediatorMessagesGuard::bridgeMessageAllowed
......ForeignAMBNativeToErc20::bridgeSpecificActionsOnTokenTransfer
>>Token
........BurnableToken::burn
..........BurnableToken::_burn
>>Mediator
........TokenBridgeMediator::passMessage
..........TokenBridgeMediator::setMessageHashValue
..........TokenBridgeMediator::setMessageHashRecipient
..........TokenBridgeMediator::setNonce
>>Bridge
..........MessageDelivery::requireToPassMessage
............ForeignAMB::emitEventOnMessageRequest
..............emit UserRequestForAffirmation
```

#### Execution

```=
>>Bridge
BasicHomeAMB::executeAffirmation
..BasicHomeAMB::handleMessage
....ArbitraryMessage::unpackData
....MessageProcessor::processMessage
......MessageProcessor::_passMessage
........MessageProcessor::setMessageSender
........MessageProcessor::setTransactionHash
>>Mediator
........TokenBridgeMediator::handleBridgedTokens
..........HomeAMBNativeToErc20::executeActionOnBridgedTokens
............RewardableMediator::distributeFee
..............HomeAMBNativeToErc20::onFeeDistribution
................Address::safeSendValue
>>Fee Manager
..............BaseMediatorFeeManager::onTokenTransfer
................BaseMediatorFeeManager::distributeFee
..................HomeFeeManagerAMBNativeToErc20::onFeeDistribution
....................Address::safeSendValue
>>Mediator
............Address::safeSendValue
............emit TokensBridged
>>Bridge
......MessageProcessor::setMessageCallStatus
......HomeAMB::emitEventOnMessageProcessed
........emit AffirmationCompleted
```

## Tokens relay: failure and recovery

Due to asynchronous nature of the Arbitrary Message Bridge, for the mediator contracts
there is a possibility to provide a way how to recover an operation if the data relay request has been failed within the mediator contract on another side.

For the token bridging this means that:
  * if the operation to mint tokens as part of the Home->Foreign request processing was failed it is possible to unlock the tokens on the Home side;
  * if the operation to unlock tokens as part of the Foreign->Home request processing was failed it is possible to mint burnt tokens on the Foreign side.

The mediator can get the status of the corresponding relay request from the bridge contract by using the id of this request (originating transaction hash). So, as soon as a user would like to perform recovery they send a request with the request id to the mediator contract and if the request was failed indeed the mediator originates the recovery message to the mediator on another side. The recovery messages contain the same information as it was used by the tokens relay request, so the terminating mediator checks that such request was registered and executes actual recovery by using amount of tokens from the request and the request sender.

### Home to Foreign

#### Execution Failure

```=
>>Bridge
BasicForeignAMB::executeSignatures
..ArbitraryMessage.unpackData
....MessageProcessor::processMessage
......MessageProcessor::_passMessage
........MessageProcessor::setMessageSender
........MessageProcessor::setTransactionHash
>>Mediator
........[failed TokenBridgeMediator::handleBridgedTokens]
>>Bridge
......MessageProcessor::setMessageCallStatus
......MessageProcessor::setFailedMessageDataHash
......MessageProcessor::setFailedMessageReceiver
......MessageProcessor::setFailedMessageSender
......ForeignAMB::emitEventOnMessageProcessed
........emit RelayedMessage
```

#### Recovery initialization

```=
>>Mediator
TokenBridgeMediator::requestFailedMessageFix
>>Bridge
..MessageProcessor::messageCallStatus
..MessageProcessor::failedMessageReceiver
..MessageProcessor::failedMessageSender
..MessageProcessor::failedMessageDataHash
..MessageDelivery::requireToPassMessage
....ForeignAMB::emitEventOnMessageRequest
......emit UserRequestForAffirmation
```

#### Recovery completion

```=
>>Bridge
BasicHomeAMB::executeAffirmation
..BasicHomeAMB::handleMessage
....ArbitraryMessage::unpackData
....MessageProcessor::processMessage
......MessageProcessor::_passMessage
........MessageProcessor::setMessageSender
........MessageProcessor::setTransactionHash
>>Mediator
........TokenBridgeMediator::fixFailedMessage
..........TokenBridgeMediator::messageHashRecipient
..........TokenBridgeMediator::messageHashValue
..........HomeAMBNativeToErc20::executeActionOnFixedTokens
............Address::safeSendValue
..........emit FailedMessageFixed
>>Bridge
......MessageProcessor::setMessageCallStatus
......HomeAMB::emitEventOnMessageProcessed
........emit AffirmationCompleted
```

### Foreign to Home

#### Execution Failure

```=
>>Bridge
BasicHomeAMB::executeAffirmation
..BasicHomeAMB::handleMessage
....ArbitraryMessage::unpackData
....MessageProcessor::processMessage
......MessageProcessor::_passMessage
........MessageProcessor::setMessageSender
........MessageProcessor::setTransactionHash
>>Mediator
........[failed TokenBridgeMediator::handleBridgedTokens]
>>Bridge
......MessageProcessor::setMessageCallStatus
......MessageProcessor::setFailedMessageDataHash
......MessageProcessor::setFailedMessageReceiver
......MessageProcessor::setFailedMessageSender
......HomeAMB::emitEventOnMessageProcessed
........emit AffirmationCompleted
```

#### Recovery initialization

```=
>>Mediator
TokenBridgeMediator::requestFailedMessageFix
>>Bridge
..MessageProcessor::messageCallStatus
..MessageProcessor::failedMessageReceiver
..MessageProcessor::failedMessageSender
..MessageProcessor::failedMessageDataHash
..MessageDelivery::requireToPassMessage
....HomeAMB::emitEventOnMessageRequest
......emit UserRequestForSignature
```

#### Recovery completion

```=
>>Bridge
BasicForeignAMB::executeSignatures
..ArbitraryMessage.unpackData
....MessageProcessor::processMessage
......MessageProcessor::_passMessage
........MessageProcessor::setMessageSender
........MessageProcessor::setTransactionHash
>>Mediator
........TokenBridgeMediator::fixFailedMessage
..........TokenBridgeMediator::messageHashRecipient
..........TokenBridgeMediator::messageHashValue
..........ForeignAMBNativeToErc20::executeActionOnFixedTokens
>>Token
............MintableToken::mint
>>Mediator
..........emit FailedMessageFixed
>>Bridge
......MessageProcessor::setMessageCallStatus
......ForeignAMB::emitEventOnMessageProcessed
........emit RelayedMessage
```

## Tokens relay to an alternative receiver

The scenarios for the feature "Alternative receiver" are considered separately since the code flow of the originating transaction is slightly different.

The idea of the feature is that a user invokes a special method (`relayTokens`) on the mediator contract in order to specify the receiver of the tokens on the another side. So, the tokens will be unlocked/minted in favor of specified account rather than the request originator as it is assumed by the general approach.

### Home to Foreign

The mediator on the Home side has the `relayTokens` method which is payable. The users invokes the method with specifying the amount of tokens to relay as `value` of the originating transaction.

#### Request

```=
>>Mediator
HomeAMBNativeToErc20::relayTokens
..HomeAMBNativeToErc20::nativeTransfer
....TokenBridgeMediator::passMessage
......TokenBridgeMediator::setMessageHashValue
......TokenBridgeMediator::setMessageHashRecipient
......TokenBridgeMediator::setNonce
>>Bridge
......MessageDelivery::requireToPassMessage
........HomeAMB::emitEventOnMessageRequest
..........emit UserRequestForSignature
```

#### Execution

The same as for the general approach

### Foreign to Home

The `relayTokens` method in the mediator contract on the Foreign side must be executed only after approving the mediator to transfer ERC677 tokens. So, the originating action consists of two steps:
  * the user calls `approve` from the token contract
  * the user calls `relayTokens` from the mediator contract by specifying both the receiver of tokens on another side and the amount of tokens to exchange.

This will allow to the mediator contract to call the `transferFrom` method from the token contract to gets ERC677 tokens before burning them.

#### Request

```=
>>Mediator
ForeignAMBNativeToErc20::relayTokens
..ForeignAMBNativeToErc20::_relayTokens
>>Token
....ERC677BridgeToken::transferFrom
......StandardToken::transferFrom
........emit Transfer
......ERC677BridgeToken::callAfterTransfer
........ERC677BridgeToken::contractFallback
>>Mediator
..........ForeignAMBNativeToErc20::onTokenTransfer
............MediatorMessagesGuard::bridgeMessageAllowed
............ForeignAMBNativeToErc20::bridgeSpecificActionsOnTokenTransfer
>>Token
..............BurnableToken::burn
................BurnableToken::_burn
>>Mediator
..............TokenBridgeMediator::passMessage
................TokenBridgeMediator::setMessageHashValue
................TokenBridgeMediator::setMessageHashRecipient
................TokenBridgeMediator::setNonce
>>Bridge
................MessageDelivery::requireToPassMessage
..................ForeignAMB::emitEventOnMessageRequest
....................emit UserRequestForAffirmation
```

#### Execution

The same as for the general approach