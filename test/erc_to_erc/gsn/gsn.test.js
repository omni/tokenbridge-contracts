// Required for opengsn proper work
require('array-flat-polyfill')

const ForeignBridge = artifacts.require('ForeignBridgeErcToErc.sol')
const BridgeValidators = artifacts.require('BridgeValidators.sol')
const ERC677BridgeToken = artifacts.require('ERC677BridgeToken.sol')

const UniswapRouterMock = artifacts.require('UniswapRouterMock.sol')
const TokenPaymaster = artifacts.require('TokenPaymaster.sol')

// GSN
const { RelayProvider } = require('@opengsn/gsn')
const ethers = require('ethers')

const { toBN } = require('../../setup')
const { createMessage, sign, signatureToVRS, ether, packSignatures } = require('../../helpers/helpers')

const requireBlockConfirmations = 8
const gasPrice = web3.utils.toWei('1', 'gwei')
const homeDailyLimit = ether('1001')
const homeMaxPerTx = ether('1000')
const maxPerTx = homeMaxPerTx
const minPerTx = ether('0.01')
const dailyLimit = homeDailyLimit
const ZERO = toBN(0)
const decimalShiftZero = 0

// Result of deploying gsn via `npx gsn start`
const RelayHubAddress = '0x254dffcd3277C0b1660F6d42EFbB754edaBAbC2B'
const ForwarderAddress = '0xCfEB869F69431e42cdB54A4F4f105C19C080A601'

async function evalMetrics(target, ...metrics) {
  const before = await Promise.all(metrics.map(metric => metric()))
  await target()
  const after = await Promise.all(metrics.map(metric => metric()))
  return [...before, ...after]
}

contract('ForeignBridge_ERC20_to_ERC20_GSN', async accounts => {
  let validatorContract
  let authorities
  let owner
  let token

  let router
  let MPRelayer
  let paymaster
  before(async () => {
    validatorContract = await BridgeValidators.new()

    authorities = [accounts[1], accounts[2]]
    owner = accounts[0]
    await validatorContract.initialize(1, authorities, owner)
  })
  describe('#executeSignaturesGSN', async () => {
    const BRIDGE_TOKENS = ether('300')
    let foreignBridge
    beforeEach(async () => {
      const web3provider = web3.currentProvider

      // Deploy
      token = await ERC677BridgeToken.new('Some ERC20', 'RSZT', 18)
      router = await UniswapRouterMock.new()
      paymaster = await TokenPaymaster.new(RelayHubAddress, ForwarderAddress)

      await paymaster.setToken(token.address)
      await paymaster.setRouter(router.address)

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

      foreignBridge = await ForeignBridge.new()
      await foreignBridge.initialize(
        validatorContract.address,
        token.address,
        requireBlockConfirmations,
        gasPrice,
        [dailyLimit, maxPerTx, minPerTx],
        [homeDailyLimit, homeMaxPerTx],
        owner,
        decimalShiftZero
      )
      await foreignBridge.setTrustedForwarder(ForwarderAddress)
      await foreignBridge.setPayMaster(paymaster.address)

      await token.mint(foreignBridge.address, BRIDGE_TOKENS)
    })
    it('should allow to executeSignaturesGSN', async () => {
      const GSNUser = ethers.Wallet.createRandom()
      MPRelayer.addAccount(GSNUser.privateKey)
      ForeignBridge.setProvider(MPRelayer)

      const recipientAccount = GSNUser.address
      const transactionHash = '0x1045bfe274b88120a6b1e5d01b5ec00ab5d01098346e90e7c7a3c9b8f0181c80'

      const REQUESTED_TOKENS = ether('100')
      // 5% of `REQUESTED_TOKENS`
      const MAX_COMMISSION = REQUESTED_TOKENS.div(toBN('20'))
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

          const pr = new ethers.providers.Web3Provider(MPRelayer)
          const fb = new ethers.Contract(foreignBridge.address, ForeignBridge.abi, pr.getSigner(GSNUser.address))
          const res = await fb.executeSignaturesGSN(
            message,
            oneSignature,
            ethers.BigNumber.from(MAX_COMMISSION.toString()),
            {
              gasLimit: 500000
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
  })
})
