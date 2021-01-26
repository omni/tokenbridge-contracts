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
const ethers = require('ethers')

const { toBN } = require('../setup')
const { createMessage, sign, signatureToVRS, ether, packSignatures, evalMetrics } = require('../helpers/helpers')

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

// Result of deploying gsn via `npx gsn start`
const RelayHubAddress = '0x7cC4B1851c35959D34e635A470F6b5C43bA3C9c9'
const ForwarderAddress = '0x85a84691547b7ccF19D7c31977A7F8c0aF1FB25A'

function createEmptyAccount(relayer) {
  const GSNUser = ethers.Wallet.createRandom()
  relayer.addAccount(GSNUser.privateKey)
  return GSNUser.address
}

function getEthersGSNContract(truffleContract, address, relayer, from) {
  const pr = new ethers.providers.Web3Provider(relayer)
  return new ethers.Contract(address, truffleContract.abi, pr.getSigner(from))
}

contract('ForeignBridge_ERC20_to_Native_GSN', async accounts => {
  let validatorContract
  let authorities
  let owner
  let token
  let otherSideBridge

  let router
  let MPRelayer
  let paymaster
  before(async () => {
    validatorContract = await BridgeValidators.new()

    authorities = [accounts[1], accounts[2]]
    owner = accounts[0]
    await validatorContract.initialize(1, authorities, owner)
    otherSideBridge = await ForeignBridge.new()
  })
  describe('#executeSignaturesGSN', async () => {
    const BRIDGE_TOKENS = ether('300')
    const REQUESTED_TOKENS = BRIDGE_TOKENS

    let foreignBridge
    let GSNForeignBridge
    let GSNSigner
    beforeEach(async () => {
      token = await ERC677BridgeToken.new('Some ERC20', 'RSZT', 18)
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

      const web3provider = web3.currentProvider
      const ethersProvider = new ethers.providers.Web3Provider(web3provider)
      const signer = ethersProvider.getSigner()

      // Give Router 1 ether
      await signer.sendTransaction({
        to: router.address,
        value: ethers.utils.parseEther('1.0')
      })
      // Give Paymaster 1 ether
      await signer.sendTransaction({
        to: paymaster.address,
        value: ethers.utils.parseEther('1.0')
      })

      // GSN configuration
      const MPConfig = {
        loggerConfigration: {
          logLevel: 'debug'
        },
        paymasterAddress: paymaster.address
      }
      MPRelayer = RelayProvider.newProvider({
        provider: web3provider,
        config: MPConfig
      })
      await MPRelayer.init()
      GSNSigner = createEmptyAccount(MPRelayer)
      GSNForeignBridge = getEthersGSNContract(ForeignBridgeErcToNativeMock, foreignBridge.address, MPRelayer, GSNSigner)
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

          const res = await GSNForeignBridge.executeSignaturesGSN(
            message,
            oneSignature,
            ethers.BigNumber.from(MAX_COMMISSION.toString()),
            {
              from: recipientAccount,
              gasLimit: GSNGasLimit
            }
          )

          await res.wait()
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
      const from = createEmptyAccount(MPRelayer)

      const recipientAccount = from
      const transactionHash = '0x1045bfe274b88120a6b1e5d01b5ec00ab5d01098346e90e7c7a3c9b8f0181c80'

      const message = createMessage(recipientAccount, REQUESTED_TOKENS, transactionHash, foreignBridge.address)
      const signature = await sign(authorities[0], message)
      const oneSignature = packSignatures([signatureToVRS(signature)])

      await GSNForeignBridge.executeSignaturesGSN(message, oneSignature, 0, { gasLimit: 500000 }).should.be.rejected

      false.should.be.equal(await foreignBridge.relayedMessages(transactionHash))
    })
    it('should not allow second withdraw (replay attack) with same transactionHash but different recipient', async () => {
      const ethersCommission = ethers.BigNumber.from(FIVE_ETHER.toString())
      // tx 1
      const transactionHash = '0x35d3818e50234655f6aebb2a1cfbf30f59568d8a4ec72066fac5a25dbe7b8121'
      const message = createMessage(GSNSigner, REQUESTED_TOKENS, transactionHash, foreignBridge.address)
      const signature = await sign(authorities[0], message)
      const oneSignature = packSignatures([signatureToVRS(signature)])
      false.should.be.equal(await foreignBridge.relayedMessages(transactionHash))

      await GSNForeignBridge.executeSignaturesGSN(message, oneSignature, ethersCommission, { gasLimit: GSNGasLimit })
        .should.be.fulfilled

      // tx 2
      await token.mint(foreignBridge.address, BRIDGE_TOKENS)
      const message2 = createMessage(accounts[4], REQUESTED_TOKENS, transactionHash, foreignBridge.address)
      const signature2 = await sign(authorities[0], message2)
      const oneSignature2 = packSignatures([signatureToVRS(signature2)])
      true.should.be.equal(await foreignBridge.relayedMessages(transactionHash))

      const pmDepositBefore = await paymaster.getRelayHubDeposit()
      await GSNForeignBridge.executeSignaturesGSN(message2, oneSignature2, ethersCommission, { gasLimit: GSNGasLimit })
        .should.be.rejected
      const pmDepositAfter = await paymaster.getRelayHubDeposit()
      pmDepositAfter.should.be.bignumber.equal(pmDepositBefore)
    })
    it('should reject calls to other functions', async () => {
      const recipientAccount = createEmptyAccount(MPRelayer)
      const transactionHash = '0x1045bfe274b88120a6b1e5d01b5ec00ab5d01098346e90e7c7a3c9b8f0181c80'
      const message = createMessage(recipientAccount, REQUESTED_TOKENS, transactionHash, foreignBridge.address)
      const signature = await sign(authorities[0], message)
      const oneSignature = packSignatures([signatureToVRS(signature)])

      const err = await GSNForeignBridge.executeSignatures(message, oneSignature).catch(e => e.message)
      true.should.be.equal(err.includes('not allowed target'))
    })
    it('should reject not GSN calls', async () => {
      const recipientAccount = createEmptyAccount(MPRelayer)
      const transactionHash = '0x1045bfe274b88120a6b1e5d01b5ec00ab5d01098346e90e7c7a3c9b8f0181c80'
      const message = createMessage(recipientAccount, REQUESTED_TOKENS, transactionHash, foreignBridge.address)
      const signature = await sign(authorities[0], message)
      const oneSignature = packSignatures([signatureToVRS(signature)])

      const err = await foreignBridge
        .executeSignaturesGSN(message, oneSignature, FIVE_ETHER, { from: recipientAccount })
        .catch(e => e)
      err.reason.should.be.equal('invalid forwarder')
    })
  })
})
