// Required for opengsn proper work
require('array-flat-polyfill')

const ForeignBridge = artifacts.require('ForeignBridgeErcToNative.sol')
const ForeignBridgeErcToNativeMock = artifacts.require('ForeignBridgeErcToNativeMock.sol')
const BridgeValidators = artifacts.require('BridgeValidators.sol')
const ERC677BridgeToken = artifacts.require('ERC677BridgeToken.sol')

const UniswapRouterMock = artifacts.require('UniswapRouterMock.sol')
const TokenPaymaster = artifacts.require('TokenPaymaster.sol')

// GSN
const { RelayProvider } = require('@opengsn/gsn')
const { GsnTestEnvironment } = require('@opengsn/gsn/dist/GsnTestEnvironment')

const { toBN, ERROR_MSG } = require('../setup')
const {
  createMessage,
  sign,
  signatureToVRS,
  ether,
  packSignatures,
  evalMetrics,
  paymasterError
} = require('../helpers/helpers')

const requireBlockConfirmations = 8
const gasPrice = web3.utils.toWei('1', 'gwei')
const homeDailyLimit = ether('1001')
const homeMaxPerTx = ether('1000')
const maxPerTx = homeMaxPerTx
const minPerTx = ether('0.01')
const dailyLimit = homeDailyLimit
const ZERO = toBN(0)
const decimalShiftZero = 0
const FIVE_ETHER = ether('5')
const GSNGasLimit = 500000

function createEmptyAccount(relayer) {
  const GSNUser = web3.eth.accounts.create()
  relayer.addAccount(GSNUser.privateKey)
  return GSNUser.address
}

contract('ForeignBridge_ERC20_to_Native_GSN', async accounts => {
  let validatorContract
  let authorities
  let owner
  let token
  let otherSideBridge

  let router
  let paymaster
  let RelayHubAddress
  let ForwarderAddress
  before(async () => {
    // Deploy GSN
    const env = await GsnTestEnvironment.startGsn('localhost')
    RelayHubAddress = env.contractsDeployment.relayHubAddress
    ForwarderAddress = env.contractsDeployment.forwarderAddress

    validatorContract = await BridgeValidators.new()

    authorities = [accounts[1], accounts[2]]
    owner = accounts[0]
    await validatorContract.initialize(1, authorities, owner)
    otherSideBridge = await ForeignBridge.new()
  })
  after(async () => {
    await GsnTestEnvironment.stopGsn()
  })
  describe('#executeSignaturesGSN', async () => {
    const BRIDGE_TOKENS = ether('300')
    const REQUESTED_TOKENS = BRIDGE_TOKENS

    let foreignBridge
    let GSNRelayer
    let GSNSigner
    beforeEach(async () => {
      token = await ERC677BridgeToken.new('Some ERC20', 'RSZT', 18)
      ForeignBridgeErcToNativeMock.web3.setProvider(web3.currentProvider)
      foreignBridge = await ForeignBridgeErcToNativeMock.new()
      await foreignBridge.initialize(
        validatorContract.address,
        token.address,
        requireBlockConfirmations,
        gasPrice,
        [dailyLimit, maxPerTx, minPerTx],
        [homeDailyLimit, homeMaxPerTx],
        owner,
        decimalShiftZero,
        otherSideBridge.address
      )

      router = await UniswapRouterMock.new()
      paymaster = await TokenPaymaster.new(
        RelayHubAddress,
        ForwarderAddress,
        token.address,
        router.address,
        foreignBridge.address
      )
      await paymaster.setPostGasUsage(250000)

      await foreignBridge.setTrustedForwarder(ForwarderAddress)
      await foreignBridge.setPayMaster(paymaster.address)

      await token.mint(foreignBridge.address, BRIDGE_TOKENS)

      // Give Router 1 ether
      await web3.eth.sendTransaction({
        from: accounts[0],
        to: router.address,
        value: ether('1')
      })
      // Give Paymaster 1 ether
      await web3.eth.sendTransaction({
        from: accounts[0],
        to: paymaster.address,
        value: ether('1')
      })

      // GSN configuration
      GSNRelayer = await RelayProvider.newProvider({
        provider: web3.currentProvider,
        config: {
          loggerConfigration: {
            logLevel: 'debug'
          },
          paymasterAddress: paymaster.address
        }
      }).init()
      GSNSigner = createEmptyAccount(GSNRelayer)

      // From now on all calls will be relayed through GSN.
      // If you want to omit GSN specify
      // { useGSN: false } in transaction details
      ForeignBridgeErcToNativeMock.web3.setProvider(GSNRelayer)
    })
    it('should allow to executeSignaturesGSN', async () => {
      const recipientAccount = GSNSigner
      const transactionHash = '0x1045bfe274b88120a6b1e5d01b5ec00ab5d01098346e90e7c7a3c9b8f0181c80'

      const MAX_COMMISSION = FIVE_ETHER
      const [
        userTokenBalanceBefore,
        userEthBalanceBefore,
        ,
        pmTokenBalanceBefore,
        pmDepositBalanceBefore,

        userTokenBalanceAfter,
        ,
        bridgeTokenBalanceAfter,
        pmTokenBalanceAfter,
        pmDepositBalanceAfter
      ] = await evalMetrics(
        async () => {
          const message = createMessage(recipientAccount, REQUESTED_TOKENS, transactionHash, foreignBridge.address)
          const signature = await sign(authorities[0], message)
          const oneSignature = packSignatures([signatureToVRS(signature)])

          await foreignBridge.executeSignaturesGSN(message, oneSignature, MAX_COMMISSION, {
            from: recipientAccount,
            gas: GSNGasLimit
          })
        },
        async () => token.balanceOf(recipientAccount),
        async () => toBN(await web3.eth.getBalance(recipientAccount)),
        async () => token.balanceOf(foreignBridge.address),
        async () => token.balanceOf(paymaster.address),
        async () => paymaster.getRelayHubDeposit()
      )

      userEthBalanceBefore.should.be.bignumber.equal(ZERO)
      userTokenBalanceBefore.should.be.bignumber.equal(ZERO)
      userTokenBalanceAfter.should.be.bignumber.gte(REQUESTED_TOKENS.sub(MAX_COMMISSION))

      pmDepositBalanceAfter.should.be.bignumber.gte(pmDepositBalanceBefore)

      pmTokenBalanceBefore.should.be.bignumber.equal(ZERO)
      pmTokenBalanceAfter.should.be.bignumber.equal(ZERO)

      bridgeTokenBalanceAfter.should.be.bignumber.equal(BRIDGE_TOKENS.sub(REQUESTED_TOKENS))
      true.should.be.equal(await foreignBridge.relayedMessages(transactionHash))
    })
    it('should reject insufficient fee', async () => {
      const from = createEmptyAccount(GSNRelayer)

      const recipientAccount = from
      const transactionHash = '0x1045bfe274b88120a6b1e5d01b5ec00ab5d01098346e90e7c7a3c9b8f0181c80'

      const message = createMessage(recipientAccount, REQUESTED_TOKENS, transactionHash, foreignBridge.address)
      const signature = await sign(authorities[0], message)
      const oneSignature = packSignatures([signatureToVRS(signature)])

      const err = await foreignBridge.executeSignaturesGSN(message, oneSignature, ZERO, {
        from: recipientAccount,
        gas: GSNGasLimit
      }).should.be.rejected
      // NOTE: we don't use `err.reason` because after transaction failed
      // truffle contract makes eth_call to get error reason and it makes this call
      // not through GSN but directly with web3 provider.
      // `err.reason` is always the same - 'invalid forwarder'
      err.message.should.include(paymasterError("tokens fee can't cover expenses"))

      false.should.be.equal(await foreignBridge.relayedMessages(transactionHash))
    })
    it('should not allow second withdraw (replay attack) with same transactionHash but different recipient', async () => {
      // tx 1
      const from = createEmptyAccount(GSNRelayer)
      const transactionHash = '0x35d3818e50234655f6aebb2a1cfbf30f59568d8a4ec72066fac5a25dbe7b8121'
      const message = createMessage(from, REQUESTED_TOKENS, transactionHash, foreignBridge.address)
      const signature = await sign(authorities[0], message)
      const oneSignature = packSignatures([signatureToVRS(signature)])
      false.should.be.equal(await foreignBridge.relayedMessages(transactionHash))

      // Check if from not equal tokens reciever
      await foreignBridge.executeSignaturesGSN(message, oneSignature, FIVE_ETHER, { from, gas: GSNGasLimit }).should.be
        .fulfilled

      // tx 2
      await token.mint(foreignBridge.address, BRIDGE_TOKENS)
      const from2 = createEmptyAccount(GSNRelayer)
      const message2 = createMessage(from2, REQUESTED_TOKENS, transactionHash, foreignBridge.address)
      const signature2 = await sign(authorities[0], message2)
      const oneSignature2 = packSignatures([signatureToVRS(signature2)])
      true.should.be.equal(await foreignBridge.relayedMessages(transactionHash))

      const pmDepositBefore = await paymaster.getRelayHubDeposit()
      await foreignBridge.executeSignaturesGSN(message2, oneSignature2, FIVE_ETHER, { from: from2, gas: GSNGasLimit })
        .should.be.rejected

      const pmDepositAfter = await paymaster.getRelayHubDeposit()
      pmDepositAfter.should.be.bignumber.equal(pmDepositBefore)
    })
    it('should reject calls to other functions', async () => {
      const recipientAccount = createEmptyAccount(GSNRelayer)
      const transactionHash = '0x1045bfe274b88120a6b1e5d01b5ec00ab5d01098346e90e7c7a3c9b8f0181c80'
      const message = createMessage(recipientAccount, REQUESTED_TOKENS, transactionHash, foreignBridge.address)
      const signature = await sign(authorities[0], message)
      const oneSignature = packSignatures([signatureToVRS(signature)])

      const err = await foreignBridge.executeSignatures(message, oneSignature, {
        from: recipientAccount,
        gas: GSNGasLimit
      }).should.be.rejected
      err.message.should.include(paymasterError('not allowed target'))
    })
    it('should reject not GSN calls', async () => {
      const recipientAccount = accounts[0]
      const transactionHash = '0x1045bfe274b88120a6b1e5d01b5ec00ab5d01098346e90e7c7a3c9b8f0181c80'
      const message = createMessage(recipientAccount, REQUESTED_TOKENS, transactionHash, foreignBridge.address)
      const signature = await sign(authorities[0], message)
      const oneSignature = packSignatures([signatureToVRS(signature)])

      await foreignBridge
        .executeSignaturesGSN(message, oneSignature, FIVE_ETHER, { from: recipientAccount, useGSN: false })
        .should.be.rejectedWith(`${ERROR_MSG} invalid forwarder`)
    })
  })
})
