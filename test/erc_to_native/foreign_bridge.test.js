const ForeignBridge = artifacts.require('ForeignBridgeErcToNative.sol')
const ForeignBridgeV2 = artifacts.require('ForeignBridgeV2.sol')
const BridgeValidators = artifacts.require('BridgeValidators.sol')
const EternalStorageProxy = artifacts.require('EternalStorageProxy.sol')
const ERC677BridgeToken = artifacts.require('ERC677BridgeToken.sol')
const ERC20Mock = artifacts.require('ERC20Mock.sol')
const ScdMcdMigrationMock = artifacts.require('ScdMcdMigrationMock.sol')
const DaiAdapterMock = artifacts.require('DaiAdapterMock.sol')
const SaiTopMock = artifacts.require('SaiTopMock.sol')
const ForeignBridgeErcToNativeMock = artifacts.require('ForeignBridgeErcToNativeMock.sol')
const VatMock = artifacts.require('VatMock')
const DaiJoinMock = artifacts.require('DaiJoinMock')
const PotMock = artifacts.require('PotMock')
const ChaiMock = artifacts.require('ChaiMock')
const DaiMock = artifacts.require('DaiMock')
const InterestReceiverMock = artifacts.require('InterestReceiverMock.sol')

const { expect } = require('chai')
const { ERROR_MSG, ZERO_ADDRESS, toBN } = require('../setup')
const {
  createMessage,
  sign,
  signatureToVRS,
  ether,
  expectEventInLogs,
  getEvents,
  createFullAccounts,
  delay,
  packSignatures
} = require('../helpers/helpers')

const halfEther = ether('0.5')
const minDaiLimit = ether('100')
const requireBlockConfirmations = 8
const gasPrice = web3.utils.toWei('1', 'gwei')
const oneEther = ether('1')
const twoEthers = ether('2')
const homeDailyLimit = oneEther
const homeMaxPerTx = halfEther
const dailyLimit = oneEther
const maxPerTx = halfEther
const minPerTx = ether('0.01')
const ZERO = toBN(0)
const MAX_VALIDATORS = 50
const MAX_SIGNATURES = MAX_VALIDATORS
const MAX_GAS = 8000000
const decimalShiftZero = 0

async function createChaiToken(token, bridge, owner) {
  const vat = await VatMock.new({ from: owner })
  const daiJoin = await DaiJoinMock.new(vat.address, token.address, { from: owner })
  const pot = await PotMock.new(vat.address, { from: owner })
  await vat.rely(pot.address)
  await vat.rely(daiJoin.address)
  await token.rely(daiJoin.address)
  const chaiToken = await ChaiMock.new(vat.address, pot.address, daiJoin.address, token.address, { from: owner })
  await bridge.setChaiToken(chaiToken.address)
  return { chaiToken, pot }
}

contract('ForeignBridge_ERC20_to_Native', async accounts => {
  let validatorContract
  let authorities
  let owner
  let token
  let otherSideBridge
  let sai
  let dai
  let migrationContract
  let saiTop
  const user = accounts[7]
  before(async () => {
    validatorContract = await BridgeValidators.new()
    authorities = [accounts[1], accounts[2]]
    owner = accounts[0]
    await validatorContract.initialize(1, authorities, owner)
    otherSideBridge = await ForeignBridge.new()

    // Used account 11 to deploy contracts. The contract addresses will be hardcoded in ForeignBridgeErcToNativeMock
    const deployAccount = accounts[10]
    sai = await ERC20Mock.new('sai', 'SAI', 18, { from: deployAccount })
    saiTop = await SaiTopMock.new({ from: deployAccount })
    dai = await ERC20Mock.new('dai', 'DAI', 18)
    const daiAdapterMock = await DaiAdapterMock.new(dai.address)
    migrationContract = await ScdMcdMigrationMock.new(sai.address, daiAdapterMock.address, { from: deployAccount })
    await sai.transferOwnership(accounts[0], { from: deployAccount })

    await dai.mint(user, ether('100000'))

    // migration contract can mint dai
    await dai.transferOwnership(migrationContract.address)
  })
  describe('#initialize', async () => {
    it('should initialize', async () => {
      token = await ERC677BridgeToken.new('Some ERC20', 'RSZT', 18)
      const foreignBridge = await ForeignBridge.new()

      expect(await foreignBridge.erc20token()).to.be.equal(ZERO_ADDRESS)
      expect(await foreignBridge.validatorContract()).to.be.equal(ZERO_ADDRESS)
      expect(await foreignBridge.deployedAtBlock()).to.be.bignumber.equal(ZERO)
      expect(await foreignBridge.isInitialized()).to.be.equal(false)
      expect(await foreignBridge.requiredBlockConfirmations()).to.be.bignumber.equal(ZERO)
      expect(await foreignBridge.decimalShift()).to.be.bignumber.equal(ZERO)

      await foreignBridge.initialize(
        ZERO_ADDRESS,
        token.address,
        requireBlockConfirmations,
        gasPrice,
        [dailyLimit, maxPerTx, minPerTx],
        [homeDailyLimit, homeMaxPerTx],
        owner,
        decimalShiftZero,
        otherSideBridge.address
      ).should.be.rejected
      await foreignBridge.initialize(
        validatorContract.address,
        ZERO_ADDRESS,
        requireBlockConfirmations,
        gasPrice,
        [dailyLimit, maxPerTx, minPerTx],
        [homeDailyLimit, homeMaxPerTx],
        owner,
        decimalShiftZero,
        otherSideBridge.address
      ).should.be.rejected
      await foreignBridge.initialize(
        validatorContract.address,
        token.address,
        0,
        gasPrice,
        [dailyLimit, maxPerTx, minPerTx],
        [homeDailyLimit, homeMaxPerTx],
        owner,
        decimalShiftZero,
        otherSideBridge.address
      ).should.be.rejected
      await foreignBridge.initialize(
        validatorContract.address,
        token.address,
        requireBlockConfirmations,
        0,
        [dailyLimit, maxPerTx, minPerTx],
        [homeDailyLimit, homeMaxPerTx],
        owner,
        decimalShiftZero,
        otherSideBridge.address
      ).should.be.rejected
      await foreignBridge.initialize(
        validatorContract.address,
        owner,
        requireBlockConfirmations,
        gasPrice,
        [maxPerTx, maxPerTx, minPerTx],
        [homeDailyLimit, homeMaxPerTx],
        owner,
        decimalShiftZero,
        otherSideBridge.address
      ).should.be.rejected
      await foreignBridge.initialize(
        owner,
        token.address,
        requireBlockConfirmations,
        gasPrice,
        [dailyLimit, minPerTx, minPerTx],
        [homeDailyLimit, homeMaxPerTx],
        owner,
        decimalShiftZero,
        otherSideBridge.address
      ).should.be.rejected
      await foreignBridge.initialize(
        validatorContract.address,
        token.address,
        requireBlockConfirmations,
        gasPrice,
        [dailyLimit, maxPerTx, minPerTx],
        [homeMaxPerTx, homeMaxPerTx],
        owner,
        decimalShiftZero,
        otherSideBridge.address
      ).should.be.rejected

      await foreignBridge.initialize(
        validatorContract.address,
        token.address,
        requireBlockConfirmations,
        gasPrice,
        [dailyLimit, maxPerTx, minPerTx],
        [homeDailyLimit, homeMaxPerTx],
        owner,
        '9',
        ZERO_ADDRESS
      ).should.be.rejected

      const { logs } = await foreignBridge.initialize(
        validatorContract.address,
        token.address,
        requireBlockConfirmations,
        gasPrice,
        [dailyLimit, maxPerTx, minPerTx],
        [homeDailyLimit, homeMaxPerTx],
        owner,
        '9',
        otherSideBridge.address
      )

      expect(await foreignBridge.erc20token()).to.be.equal(token.address)
      expect(await foreignBridge.isInitialized()).to.be.equal(true)
      expect(await foreignBridge.validatorContract()).to.be.equal(validatorContract.address)
      expect(await foreignBridge.deployedAtBlock()).to.be.bignumber.above(ZERO)
      expect(await foreignBridge.requiredBlockConfirmations()).to.be.bignumber.equal(
        requireBlockConfirmations.toString()
      )
      expect(await foreignBridge.dailyLimit()).to.be.bignumber.equal(dailyLimit)
      expect(await foreignBridge.maxPerTx()).to.be.bignumber.equal(maxPerTx)
      expect(await foreignBridge.minPerTx()).to.be.bignumber.equal(minPerTx)
      expect(await foreignBridge.executionDailyLimit()).to.be.bignumber.equal(homeDailyLimit)
      expect(await foreignBridge.executionMaxPerTx()).to.be.bignumber.equal(homeMaxPerTx)
      expect(await foreignBridge.decimalShift()).to.be.bignumber.equal('9')
      expect(await foreignBridge.gasPrice()).to.be.bignumber.equal(gasPrice)
      const bridgeMode = '0x18762d46' // 4 bytes of keccak256('erc-to-native-core')
      expect(await foreignBridge.getBridgeMode()).to.be.equal(bridgeMode)
      const { major, minor, patch } = await foreignBridge.getBridgeInterfacesVersion()
      expect(major).to.be.bignumber.gte(ZERO)
      expect(minor).to.be.bignumber.gte(ZERO)
      expect(patch).to.be.bignumber.gte(ZERO)

      expectEventInLogs(logs, 'RequiredBlockConfirmationChanged', {
        requiredBlockConfirmations: toBN(requireBlockConfirmations)
      })
      expectEventInLogs(logs, 'GasPriceChanged', { gasPrice })
      expectEventInLogs(logs, 'DailyLimitChanged', { newLimit: dailyLimit })
      expectEventInLogs(logs, 'ExecutionDailyLimitChanged', { newLimit: homeDailyLimit })
    })
  })
  describe('#executeSignatures', async () => {
    const value = ether('0.25')
    let foreignBridge
    beforeEach(async () => {
      foreignBridge = await ForeignBridgeErcToNativeMock.new()
      token = await ERC677BridgeToken.new('Some ERC20', 'RSZT', 18)
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
      await token.mint(foreignBridge.address, value)
    })

    it('should allow to executeSignatures', async () => {
      const recipientAccount = accounts[3]
      const balanceBefore = await token.balanceOf(recipientAccount)

      const transactionHash = '0x1045bfe274b88120a6b1e5d01b5ec00ab5d01098346e90e7c7a3c9b8f0181c80'
      const message = createMessage(recipientAccount, value, transactionHash, foreignBridge.address)
      const signature = await sign(authorities[0], message)
      const vrs = signatureToVRS(signature)
      const oneSignature = packSignatures([vrs])
      false.should.be.equal(await foreignBridge.relayedMessages(transactionHash))

      const { logs } = await foreignBridge.executeSignatures(message, oneSignature).should.be.fulfilled

      logs[0].event.should.be.equal('RelayedMessage')
      logs[0].args.recipient.should.be.equal(recipientAccount)
      logs[0].args.value.should.be.bignumber.equal(value)
      const balanceAfter = await token.balanceOf(recipientAccount)
      const balanceAfterBridge = await token.balanceOf(foreignBridge.address)
      balanceAfter.should.be.bignumber.equal(balanceBefore.add(value))
      balanceAfterBridge.should.be.bignumber.equal(ZERO)
      true.should.be.equal(await foreignBridge.relayedMessages(transactionHash))
    })

    it('should allow second withdrawal with different transactionHash but same recipient and value', async () => {
      const recipientAccount = accounts[3]
      const balanceBefore = await token.balanceOf(recipientAccount)

      // tx 1
      const value = ether('0.25')
      const transactionHash = '0x35d3818e50234655f6aebb2a1cfbf30f59568d8a4ec72066fac5a25dbe7b8121'
      const message = createMessage(recipientAccount, value, transactionHash, foreignBridge.address)
      const signature = await sign(authorities[0], message)
      const vrs = signatureToVRS(signature)
      const oneSignature = packSignatures([vrs])
      false.should.be.equal(await foreignBridge.relayedMessages(transactionHash))

      await foreignBridge.executeSignatures(message, oneSignature).should.be.fulfilled

      // tx 2
      await token.mint(foreignBridge.address, value)
      const transactionHash2 = '0x77a496628a776a03d58d7e6059a5937f04bebd8ba4ff89f76dd4bb8ba7e291ee'
      const message2 = createMessage(recipientAccount, value, transactionHash2, foreignBridge.address)
      const signature2 = await sign(authorities[0], message2)
      const vrs2 = signatureToVRS(signature2)
      const oneSignature2 = packSignatures([vrs2])
      false.should.be.equal(await foreignBridge.relayedMessages(transactionHash2))

      const { logs } = await foreignBridge.executeSignatures(message2, oneSignature2).should.be.fulfilled

      logs[0].event.should.be.equal('RelayedMessage')
      logs[0].args.recipient.should.be.equal(recipientAccount)
      logs[0].args.value.should.be.bignumber.equal(value)
      const balanceAfter = await token.balanceOf(recipientAccount)
      balanceAfter.should.be.bignumber.equal(balanceBefore.add(value.mul(toBN(2))))
      true.should.be.equal(await foreignBridge.relayedMessages(transactionHash))
      true.should.be.equal(await foreignBridge.relayedMessages(transactionHash2))
    })

    it('should not allow second withdraw (replay attack) with same transactionHash but different recipient', async () => {
      const recipientAccount = accounts[3]

      // tx 1
      const transactionHash = '0x35d3818e50234655f6aebb2a1cfbf30f59568d8a4ec72066fac5a25dbe7b8121'
      const message = createMessage(recipientAccount, value, transactionHash, foreignBridge.address)
      const signature = await sign(authorities[0], message)
      const vrs = signatureToVRS(signature)
      const oneSignature = packSignatures([vrs])
      false.should.be.equal(await foreignBridge.relayedMessages(transactionHash))

      await foreignBridge.executeSignatures(message, oneSignature).should.be.fulfilled

      // tx 2
      await token.mint(foreignBridge.address, value)
      const message2 = createMessage(accounts[4], value, transactionHash, foreignBridge.address)
      const signature2 = await sign(authorities[0], message2)
      const vrs2 = signatureToVRS(signature2)
      const oneSignature2 = packSignatures([vrs2])
      true.should.be.equal(await foreignBridge.relayedMessages(transactionHash))

      await foreignBridge.executeSignatures(message2, oneSignature2).should.be.rejectedWith(ERROR_MSG)
    })

    it('should not allow withdraw over home max tx limit', async () => {
      const recipientAccount = accounts[3]
      const invalidValue = ether('0.75')
      await token.mint(foreignBridge.address, ether('5'))

      const transactionHash = '0x35d3818e50234655f6aebb2a1cfbf30f59568d8a4ec72066fac5a25dbe7b8121'
      const message = createMessage(recipientAccount, invalidValue, transactionHash, foreignBridge.address)
      const signature = await sign(authorities[0], message)
      const vrs = signatureToVRS(signature)
      const oneSignature = packSignatures([vrs])

      await foreignBridge.executeSignatures(message, oneSignature).should.be.rejectedWith(ERROR_MSG)
    })

    it('should not allow withdraw over daily home limit', async () => {
      const recipientAccount = accounts[3]
      await token.mint(foreignBridge.address, ether('5'))

      const transactionHash = '0x35d3818e50234655f6aebb2a1cfbf30f59568d8a4ec72066fac5a25dbe7b8121'
      const message = createMessage(recipientAccount, halfEther, transactionHash, foreignBridge.address)
      const signature = await sign(authorities[0], message)
      const vrs = signatureToVRS(signature)
      const oneSignature = packSignatures([vrs])

      await foreignBridge.executeSignatures(message, oneSignature).should.be.fulfilled

      const transactionHash2 = '0x69debd8fd1923c9cb3cd8ef6461e2740b2d037943b941729d5a47671a2bb8712'
      const message2 = createMessage(recipientAccount, halfEther, transactionHash2, foreignBridge.address)
      const signature2 = await sign(authorities[0], message2)
      const vrs2 = signatureToVRS(signature2)
      const oneSignature2 = packSignatures([vrs2])

      await foreignBridge.executeSignatures(message2, oneSignature2).should.be.fulfilled

      const transactionHash3 = '0x022695428093bb292db8e48bd1417c5e1b84c0bf673bd0fff23ed0fb6495b872'
      const message3 = createMessage(recipientAccount, halfEther, transactionHash3, foreignBridge.address)
      const signature3 = await sign(authorities[0], message3)
      const vrs3 = signatureToVRS(signature3)
      const oneSignature3 = packSignatures([vrs3])

      await foreignBridge.executeSignatures(message3, oneSignature3).should.be.rejectedWith(ERROR_MSG)
    })
  })
  describe('#executeSignatures with chai', async () => {
    const value = ether('0.25')
    let foreignBridge
    let chaiToken
    beforeEach(async () => {
      foreignBridge = await ForeignBridgeErcToNativeMock.new()
      token = await DaiMock.new({ from: owner })
      chaiToken = (await createChaiToken(token, foreignBridge, owner)).chaiToken
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
      await token.mint(foreignBridge.address, value)
    })

    it('should executeSignatures with enabled chai token, enough dai', async () => {
      await foreignBridge.methods['initializeChaiToken()']()
      expect(await chaiToken.balanceOf(foreignBridge.address)).to.be.bignumber.equal(ZERO)
      expect(await token.balanceOf(foreignBridge.address)).to.be.bignumber.equal(value)

      const recipientAccount = accounts[3]
      const balanceBefore = await token.balanceOf(recipientAccount)

      const transactionHash = '0x1045bfe274b88120a6b1e5d01b5ec00ab5d01098346e90e7c7a3c9b8f0181c80'
      const message = createMessage(recipientAccount, value, transactionHash, foreignBridge.address)
      const signature = await sign(authorities[0], message)
      const vrs = signatureToVRS(signature)
      const oneSignature = packSignatures([vrs])
      false.should.be.equal(await foreignBridge.relayedMessages(transactionHash))

      const { logs } = await foreignBridge.executeSignatures(message, oneSignature).should.be.fulfilled

      logs[0].event.should.be.equal('RelayedMessage')
      logs[0].args.recipient.should.be.equal(recipientAccount)
      logs[0].args.value.should.be.bignumber.equal(value)
      const balanceAfter = await token.balanceOf(recipientAccount)
      const balanceAfterBridge = await token.balanceOf(foreignBridge.address)
      balanceAfter.should.be.bignumber.equal(balanceBefore.add(value))
      balanceAfterBridge.should.be.bignumber.equal(ZERO)
      true.should.be.equal(await foreignBridge.relayedMessages(transactionHash))

      expect(await chaiToken.balanceOf(foreignBridge.address)).to.be.bignumber.equal(ZERO)
    })

    it('should executeSignatures with enabled chai token, not enough dai, low dai limit', async () => {
      await foreignBridge.methods['initializeChaiToken()']({ from: owner })
      await token.mint(foreignBridge.address, ether('1'), { from: owner })
      // in case of low limit, bridge should withdraw tokens up to specified DAI limit
      await foreignBridge.setMinDaiTokenBalance(ether('0.1'), { from: owner })
      await foreignBridge.convertDaiToChai()
      expect(await chaiToken.balanceOf(foreignBridge.address)).to.be.bignumber.gt(ZERO)
      expect(await token.balanceOf(foreignBridge.address)).to.be.bignumber.equal(ether('0.1'))

      const recipientAccount = accounts[3]
      const balanceBefore = await token.balanceOf(recipientAccount)

      const transactionHash = '0x1045bfe274b88120a6b1e5d01b5ec00ab5d01098346e90e7c7a3c9b8f0181c80'
      const message = createMessage(recipientAccount, value, transactionHash, foreignBridge.address)
      const signature = await sign(authorities[0], message)
      const vrs = signatureToVRS(signature)
      const oneSignature = packSignatures([vrs])
      false.should.be.equal(await foreignBridge.relayedMessages(transactionHash))

      // wait for a small interest in DSR
      await delay(1500)

      const { logs } = await foreignBridge.executeSignatures(message, oneSignature).should.be.fulfilled

      logs[0].event.should.be.equal('TokensSwapped')
      logs[0].args.from.should.be.equal(chaiToken.address)
      logs[0].args.to.should.be.equal(token.address)
      logs[0].args.value.should.be.bignumber.equal(value)
      logs[1].event.should.be.equal('RelayedMessage')
      logs[1].args.recipient.should.be.equal(recipientAccount)
      logs[1].args.value.should.be.bignumber.equal(value)
      const balanceAfter = await token.balanceOf(recipientAccount)
      const balanceAfterBridge = await token.balanceOf(foreignBridge.address)
      balanceAfter.should.be.bignumber.equal(balanceBefore.add(value))
      balanceAfterBridge.should.be.bignumber.equal(ether('0.1'))
      true.should.be.equal(await foreignBridge.relayedMessages(transactionHash))
    })

    it('should executeSignatures with enabled chai token, not enough dai, high dai limit', async () => {
      await foreignBridge.methods['initializeChaiToken()']({ from: owner })
      await token.mint(foreignBridge.address, ether('1'), { from: owner })
      await foreignBridge.setMinDaiTokenBalance(ether('0.1'), { from: owner })
      await foreignBridge.convertDaiToChai()
      // in case of high limit, bridge should withdraw all invested tokens
      await foreignBridge.setMinDaiTokenBalance(ether('5'), { from: owner })
      expect(await chaiToken.balanceOf(foreignBridge.address)).to.be.bignumber.gt(ZERO)
      expect(await token.balanceOf(foreignBridge.address)).to.be.bignumber.gte(ether('0.1'))
      expect(await token.balanceOf(foreignBridge.address)).to.be.bignumber.lte(ether('0.11'))

      const recipientAccount = accounts[3]
      const balanceBefore = await token.balanceOf(recipientAccount)

      const transactionHash = '0x1045bfe274b88120a6b1e5d01b5ec00ab5d01098346e90e7c7a3c9b8f0181c80'
      const message = createMessage(recipientAccount, value, transactionHash, foreignBridge.address)
      const signature = await sign(authorities[0], message)
      const vrs = signatureToVRS(signature)
      const oneSignature = packSignatures([vrs])
      false.should.be.equal(await foreignBridge.relayedMessages(transactionHash))

      // wait for a small interest in DSR
      await delay(1500)

      const { logs } = await foreignBridge.executeSignatures(message, oneSignature).should.be.fulfilled

      logs[0].event.should.be.equal('TokensSwapped')
      logs[0].args.from.should.be.equal(chaiToken.address)
      logs[0].args.to.should.be.equal(token.address)
      logs[0].args.value.should.be.bignumber.equal(ether('1.15'))
      logs[1].event.should.be.equal('RelayedMessage')
      logs[1].args.recipient.should.be.equal(recipientAccount)
      logs[1].args.value.should.be.bignumber.equal(value)
      const balanceAfter = await token.balanceOf(recipientAccount)
      const balanceAfterBridge = await token.balanceOf(foreignBridge.address)
      balanceAfter.should.be.bignumber.equal(balanceBefore.add(value))
      balanceAfterBridge.should.be.bignumber.gte(ether('1'))
      true.should.be.equal(await foreignBridge.relayedMessages(transactionHash))
      // small remaining interest, collected between calls to convertDaiToChai() and executeSignatures()
      expect(await chaiToken.balanceOf(foreignBridge.address)).to.be.bignumber.lt(ether('0.0001'))
    })
  })
  describe('#withdraw with 2 minimum signatures', async () => {
    let multisigValidatorContract
    let twoAuthorities
    let ownerOfValidatorContract
    let foreignBridgeWithMultiSignatures
    const value = halfEther
    beforeEach(async () => {
      multisigValidatorContract = await BridgeValidators.new()
      token = await ERC677BridgeToken.new('Some ERC20', 'RSZT', 18)
      twoAuthorities = [accounts[0], accounts[1]]
      ownerOfValidatorContract = accounts[3]
      await multisigValidatorContract.initialize(2, twoAuthorities, ownerOfValidatorContract, {
        from: ownerOfValidatorContract
      })
      foreignBridgeWithMultiSignatures = await ForeignBridgeErcToNativeMock.new()
      await foreignBridgeWithMultiSignatures.initialize(
        multisigValidatorContract.address,
        token.address,
        requireBlockConfirmations,
        gasPrice,
        [dailyLimit, maxPerTx, minPerTx],
        [homeDailyLimit, homeMaxPerTx],
        owner,
        decimalShiftZero,
        otherSideBridge.address,
        { from: ownerOfValidatorContract }
      )
      await token.mint(foreignBridgeWithMultiSignatures.address, value)
    })

    it('withdraw should fail if not enough signatures are provided', async () => {
      const recipientAccount = accounts[4]

      // msg 1
      const transactionHash = '0x35d3818e50234655f6aebb2a1cfbf30f59568d8a4ec72066fac5a25dbe7b8121'
      const message = createMessage(recipientAccount, value, transactionHash, foreignBridgeWithMultiSignatures.address)
      const signature = await sign(twoAuthorities[0], message)
      const vrs = signatureToVRS(signature)
      const oneSignature = packSignatures([vrs])
      false.should.be.equal(await foreignBridgeWithMultiSignatures.relayedMessages(transactionHash))

      await foreignBridgeWithMultiSignatures.executeSignatures(message, oneSignature).should.be.rejectedWith(ERROR_MSG)

      // msg 2
      const signature2 = await sign(twoAuthorities[1], message)
      const vrs2 = signatureToVRS(signature2)
      const twoSignatures = packSignatures([vrs, vrs2])

      const { logs } = await foreignBridgeWithMultiSignatures.executeSignatures(message, twoSignatures).should.be
        .fulfilled

      logs[0].event.should.be.equal('RelayedMessage')
      logs[0].args.recipient.should.be.equal(recipientAccount)
      logs[0].args.value.should.be.bignumber.equal(value)
      true.should.be.equal(await foreignBridgeWithMultiSignatures.relayedMessages(transactionHash))
    })

    it('withdraw should fail if duplicate signature is provided', async () => {
      const recipientAccount = accounts[4]
      const transactionHash = '0x35d3818e50234655f6aebb2a1cfbf30f59568d8a4ec72066fac5a25dbe7b8121'
      const message = createMessage(recipientAccount, value, transactionHash, foreignBridgeWithMultiSignatures.address)
      const signature = await sign(twoAuthorities[0], message)
      const vrs = signatureToVRS(signature)
      const twoSignatures = packSignatures([vrs, vrs])
      false.should.be.equal(await foreignBridgeWithMultiSignatures.relayedMessages(transactionHash))

      await foreignBridgeWithMultiSignatures.executeSignatures(message, twoSignatures).should.be.rejectedWith(ERROR_MSG)
    })
    it('works with 5 validators and 3 required signatures', async () => {
      const recipient = accounts[8]
      const authoritiesFiveAccs = [accounts[1], accounts[2], accounts[3], accounts[4], accounts[5]]
      const ownerOfValidators = accounts[0]
      const validatorContractWith3Signatures = await BridgeValidators.new()
      await validatorContractWith3Signatures.initialize(3, authoritiesFiveAccs, ownerOfValidators)
      const erc20Token = await ERC677BridgeToken.new('Some ERC20', 'RSZT', 18)
      const value = halfEther
      const foreignBridgeWithThreeSigs = await ForeignBridgeErcToNativeMock.new()

      await foreignBridgeWithThreeSigs.initialize(
        validatorContractWith3Signatures.address,
        erc20Token.address,
        requireBlockConfirmations,
        gasPrice,
        [dailyLimit, maxPerTx, minPerTx],
        [homeDailyLimit, homeMaxPerTx],
        owner,
        decimalShiftZero,
        otherSideBridge.address
      )
      await erc20Token.mint(foreignBridgeWithThreeSigs.address, value)

      const txHash = '0x35d3818e50234655f6aebb2a1cfbf30f59568d8a4ec72066fac5a25dbe7b8121'
      const message = createMessage(recipient, value, txHash, foreignBridgeWithThreeSigs.address)

      // signature 1
      const signature = await sign(authoritiesFiveAccs[0], message)
      const vrs = signatureToVRS(signature)

      // signature 2
      const signature2 = await sign(authoritiesFiveAccs[1], message)
      const vrs2 = signatureToVRS(signature2)

      // signature 3
      const signature3 = await sign(authoritiesFiveAccs[2], message)
      const vrs3 = signatureToVRS(signature3)

      const threeSignatures = packSignatures([vrs, vrs2, vrs3])

      const { logs } = await foreignBridgeWithThreeSigs.executeSignatures(message, threeSignatures).should.be.fulfilled
      logs[0].event.should.be.equal('RelayedMessage')
      logs[0].args.recipient.should.be.equal(recipient)
      logs[0].args.value.should.be.bignumber.equal(value)
      true.should.be.equal(await foreignBridgeWithThreeSigs.relayedMessages(txHash))
    })
    it('works with max allowed number of signatures required', async () => {
      const recipient = accounts[8]
      const value = halfEther
      const validatorContract = await BridgeValidators.new()
      const authorities = createFullAccounts(web3, MAX_VALIDATORS)
      const addresses = authorities.map(account => account.address)
      const ownerOfValidators = accounts[0]

      await validatorContract.initialize(MAX_SIGNATURES, addresses, ownerOfValidators)
      const erc20Token = await ERC677BridgeToken.new('Some ERC20', 'RSZT', 18)
      const foreignBridgeWithMaxSigs = await ForeignBridgeErcToNativeMock.new()

      await foreignBridgeWithMaxSigs.initialize(
        validatorContract.address,
        erc20Token.address,
        requireBlockConfirmations,
        gasPrice,
        [dailyLimit, maxPerTx, minPerTx],
        [homeDailyLimit, homeMaxPerTx],
        owner,
        decimalShiftZero,
        otherSideBridge.address
      )
      await erc20Token.mint(foreignBridgeWithMaxSigs.address, value)

      const txHash = '0x35d3818e50234655f6aebb2a1cfbf30f59568d8a4ec72066fac5a25dbe7b8121'
      const message = createMessage(recipient, value, txHash, foreignBridgeWithMaxSigs.address)

      const vrsList = []
      for (let i = 0; i < MAX_SIGNATURES; i++) {
        const { signature } = await authorities[i].sign(message)
        vrsList[i] = signatureToVRS(signature)
      }

      const maxSignatures = packSignatures(vrsList)

      const { receipt } = await foreignBridgeWithMaxSigs.executeSignatures(message, maxSignatures).should.be.fulfilled
      expect(receipt.gasUsed).to.be.lte(MAX_GAS)
    })
  })
  describe('#upgradeable', async () => {
    it('can be upgraded', async () => {
      const REQUIRED_NUMBER_OF_VALIDATORS = 1
      const VALIDATORS = [accounts[1]]
      const PROXY_OWNER = accounts[0]
      // Validators Contract
      let validatorsProxy = await EternalStorageProxy.new().should.be.fulfilled
      const validatorsContractImpl = await BridgeValidators.new().should.be.fulfilled
      await validatorsProxy.upgradeTo('1', validatorsContractImpl.address).should.be.fulfilled
      validatorsContractImpl.address.should.be.equal(await validatorsProxy.implementation())

      validatorsProxy = await BridgeValidators.at(validatorsProxy.address)
      await validatorsProxy.initialize(REQUIRED_NUMBER_OF_VALIDATORS, VALIDATORS, PROXY_OWNER).should.be.fulfilled
      const token = await ERC677BridgeToken.new('Some ERC20', 'RSZT', 18)

      // ForeignBridge V1 Contract

      let foreignBridgeProxy = await EternalStorageProxy.new().should.be.fulfilled
      const foreignBridgeImpl = await ForeignBridge.new().should.be.fulfilled
      await foreignBridgeProxy.upgradeTo('1', foreignBridgeImpl.address).should.be.fulfilled

      foreignBridgeProxy = await ForeignBridge.at(foreignBridgeProxy.address)
      await foreignBridgeProxy.initialize(
        validatorsProxy.address,
        token.address,
        requireBlockConfirmations,
        gasPrice,
        [dailyLimit, maxPerTx, minPerTx],
        [homeDailyLimit, homeMaxPerTx],
        owner,
        decimalShiftZero,
        otherSideBridge.address
      )

      // Deploy V2
      const foreignImplV2 = await ForeignBridgeV2.new()
      const foreignBridgeProxyUpgrade = await EternalStorageProxy.at(foreignBridgeProxy.address)
      await foreignBridgeProxyUpgrade.upgradeTo('2', foreignImplV2.address).should.be.fulfilled
      foreignImplV2.address.should.be.equal(await foreignBridgeProxyUpgrade.implementation())
    })

    it('can be deployed via upgradeToAndCall', async () => {
      const tokenAddress = token.address
      const validatorsAddress = validatorContract.address

      const storageProxy = await EternalStorageProxy.new().should.be.fulfilled
      const foreignBridge = await ForeignBridge.new()
      const data = foreignBridge.contract.methods
        .initialize(
          validatorsAddress,
          tokenAddress,
          requireBlockConfirmations,
          gasPrice,
          ['3', '2', '1'],
          ['3', '2'],
          owner,
          decimalShiftZero,
          otherSideBridge.address
        )
        .encodeABI()

      await storageProxy.upgradeToAndCall('1', foreignBridge.address, data).should.be.fulfilled

      const finalContract = await ForeignBridge.at(storageProxy.address)
      true.should.be.equal(await finalContract.isInitialized())
      validatorsAddress.should.be.equal(await finalContract.validatorContract())
    })
  })
  describe('#claimTokens', async () => {
    it('can send erc20', async () => {
      const owner = accounts[0]
      token = await ERC677BridgeToken.new('Some ERC20', 'RSZT', 18)
      const foreignBridgeImpl = await ForeignBridge.new()
      const storageProxy = await EternalStorageProxy.new().should.be.fulfilled
      await storageProxy.upgradeTo('1', foreignBridgeImpl.address).should.be.fulfilled
      const foreignBridge = await ForeignBridge.at(storageProxy.address)

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
      const tokenSecond = await ERC677BridgeToken.new('Roman Token', 'RST', 18)

      await tokenSecond.mint(accounts[0], halfEther).should.be.fulfilled
      expect(await tokenSecond.balanceOf(accounts[0])).to.be.bignumber.equal(halfEther)

      await tokenSecond.transfer(foreignBridge.address, halfEther)
      expect(await tokenSecond.balanceOf(accounts[0])).to.be.bignumber.equal(ZERO)
      expect(await tokenSecond.balanceOf(foreignBridge.address)).to.be.bignumber.equal(halfEther)

      await foreignBridge
        .claimTokens(tokenSecond.address, accounts[3], { from: accounts[3] })
        .should.be.rejectedWith(ERROR_MSG)
      await foreignBridge.claimTokens(tokenSecond.address, accounts[3], { from: owner })
      expect(await tokenSecond.balanceOf(foreignBridge.address)).to.be.bignumber.equal(ZERO)
      expect(await tokenSecond.balanceOf(accounts[3])).to.be.bignumber.equal(halfEther)
    })
  })
  describe('#decimalShift', async () => {
    const decimalShiftTwo = 2
    it('Home to Foreign: withdraw with 1 signature with a decimalShift of 2', async () => {
      // From a foreign a token erc token 16 decimals.
      const token = await ERC677BridgeToken.new('Some ERC20', 'RSZT', 16)
      const valueOnForeign = toBN('1000')
      // Value is decimals shifted from foreign to home: Native on home = 16+2 shift = 18 decimals
      const valueOnHome = toBN(valueOnForeign * 10 ** decimalShiftTwo)

      const owner = accounts[0]
      const foreignBridgeImpl = await ForeignBridgeErcToNativeMock.new()
      const storageProxy = await EternalStorageProxy.new().should.be.fulfilled
      await storageProxy.upgradeTo('1', foreignBridgeImpl.address).should.be.fulfilled
      const foreignBridge = await ForeignBridge.at(storageProxy.address)

      await foreignBridge.initialize(
        validatorContract.address,
        token.address,
        requireBlockConfirmations,
        gasPrice,
        [dailyLimit, maxPerTx, minPerTx],
        [homeDailyLimit, homeMaxPerTx],
        owner,
        decimalShiftTwo,
        otherSideBridge.address
      )
      await token.mint(foreignBridge.address, valueOnForeign)

      const recipientAccount = accounts[3]
      const balanceBefore = await token.balanceOf(recipientAccount)

      const transactionHash = '0x1045bfe274b88120a6b1e5d01b5ec00ab5d01098346e90e7c7a3c9b8f0181c80'
      const message = createMessage(recipientAccount, valueOnHome, transactionHash, foreignBridge.address)
      const signature = await sign(authorities[0], message)
      const vrs = signatureToVRS(signature)
      const oneSignature = packSignatures([vrs])
      false.should.be.equal(await foreignBridge.relayedMessages(transactionHash))

      const { logs } = await foreignBridge.executeSignatures(message, oneSignature).should.be.fulfilled

      logs[0].event.should.be.equal('RelayedMessage')
      logs[0].args.recipient.should.be.equal(recipientAccount)
      logs[0].args.value.should.be.bignumber.equal(valueOnHome)
      const balanceAfter = await token.balanceOf(recipientAccount)
      balanceAfter.should.be.bignumber.equal(balanceBefore.add(valueOnForeign))
      const balanceAfterBridge = await token.balanceOf(foreignBridge.address)
      balanceAfterBridge.should.be.bignumber.equal(ZERO)
      true.should.be.equal(await foreignBridge.relayedMessages(transactionHash))
    })

    it('Home to Foreign: withdraw with 2 minimum signatures with a decimalShift of 2', async () => {
      const multisigValidatorContract = await BridgeValidators.new()
      const valueOnForeign = toBN('1000')
      const decimalShiftTwo = 2
      const valueOnHome = toBN(valueOnForeign * 10 ** decimalShiftTwo)
      const token = await ERC677BridgeToken.new('Some ERC20', 'RSZT', 16)
      const twoAuthorities = [accounts[0], accounts[1]]
      const ownerOfValidatorContract = accounts[3]
      const recipient = accounts[8]
      await multisigValidatorContract.initialize(2, twoAuthorities, ownerOfValidatorContract, {
        from: ownerOfValidatorContract
      })
      const foreignBridgeWithMultiSignatures = await ForeignBridgeErcToNativeMock.new()
      await foreignBridgeWithMultiSignatures.initialize(
        multisigValidatorContract.address,
        token.address,
        requireBlockConfirmations,
        gasPrice,
        [dailyLimit, maxPerTx, minPerTx],
        [homeDailyLimit, homeMaxPerTx],
        owner,
        decimalShiftTwo,
        otherSideBridge.address,
        { from: ownerOfValidatorContract }
      )
      await token.mint(foreignBridgeWithMultiSignatures.address, valueOnForeign)

      const balanceBefore = await token.balanceOf(recipient)

      const txHash = '0x35d3818e50234655f6aebb2a1cfbf30f59568d8a4ec72066fac5a25dbe7b8121'
      const message = createMessage(recipient, valueOnHome, txHash, foreignBridgeWithMultiSignatures.address)

      // signature 1
      const signature = await sign(twoAuthorities[0], message)
      const vrs = signatureToVRS(signature)

      // signature 2
      const signature2 = await sign(twoAuthorities[1], message)
      const vrs2 = signatureToVRS(signature2)

      const twoSignatures = packSignatures([vrs, vrs2])

      const { logs } = await foreignBridgeWithMultiSignatures.executeSignatures(message, twoSignatures).should.be
        .fulfilled
      logs[0].event.should.be.equal('RelayedMessage')
      logs[0].args.recipient.should.be.equal(recipient)
      logs[0].args.value.should.be.bignumber.equal(valueOnHome)
      const balanceAfter = await token.balanceOf(recipient)
      balanceAfter.should.be.bignumber.equal(balanceBefore.add(valueOnForeign))
      const balanceAfterBridge = await token.balanceOf(foreignBridgeWithMultiSignatures.address)
      balanceAfterBridge.should.be.bignumber.equal(ZERO)
      true.should.be.equal(await foreignBridgeWithMultiSignatures.relayedMessages(txHash))
    })
  })
  describe('#relayTokens', () => {
    const value = ether('0.25')
    const user = accounts[7]
    const recipient = accounts[8]
    let foreignBridge
    beforeEach(async () => {
      foreignBridge = await ForeignBridge.new()
      token = await ERC677BridgeToken.new('Some ERC20', 'RSZT', 18)
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
      await token.mint(user, ether('2'))
    })
    it('should allow to bridge tokens using approve and relayTokens', async () => {
      // Given
      const currentDay = await foreignBridge.getCurrentDay()
      expect(await foreignBridge.totalSpentPerDay(currentDay)).to.be.bignumber.equal(ZERO)

      await foreignBridge.methods['relayTokens(address,address,uint256)'](user, recipient, value, {
        from: user
      }).should.be.rejectedWith(ERROR_MSG)

      await token.approve(foreignBridge.address, value, { from: user }).should.be.fulfilled

      // When
      await foreignBridge.methods['relayTokens(address,address,uint256)'](user, ZERO_ADDRESS, value, {
        from: user
      }).should.be.rejectedWith(ERROR_MSG)
      await foreignBridge.methods['relayTokens(address,address,uint256)'](user, foreignBridge.address, value, {
        from: user
      }).should.be.rejectedWith(ERROR_MSG)
      await foreignBridge.methods['relayTokens(address,address,uint256)'](user, user, 0, {
        from: user
      }).should.be.rejectedWith(ERROR_MSG)
      const { logs } = await foreignBridge.methods['relayTokens(address,address,uint256)'](user, user, value, {
        from: user
      }).should.be.fulfilled

      // Then
      expect(await foreignBridge.totalSpentPerDay(currentDay)).to.be.bignumber.equal(value)
      expectEventInLogs(logs, 'UserRequestForAffirmation', {
        recipient: user,
        value
      })
    })
    it('should allow to bridge tokens using approve and relayTokens with different recipient', async () => {
      // Given
      const currentDay = await foreignBridge.getCurrentDay()
      expect(await foreignBridge.totalSpentPerDay(currentDay)).to.be.bignumber.equal(ZERO)

      await foreignBridge.methods['relayTokens(address,address,uint256)'](user, recipient, value, {
        from: user
      }).should.be.rejectedWith(ERROR_MSG)

      await token.approve(foreignBridge.address, value, { from: user }).should.be.fulfilled

      // When
      await foreignBridge.methods['relayTokens(address,address,uint256)'](user, ZERO_ADDRESS, value, {
        from: user
      }).should.be.rejectedWith(ERROR_MSG)
      await foreignBridge.methods['relayTokens(address,address,uint256)'](user, foreignBridge.address, value, {
        from: user
      }).should.be.rejectedWith(ERROR_MSG)
      await foreignBridge.methods['relayTokens(address,address,uint256)'](user, recipient, 0, {
        from: user
      }).should.be.rejectedWith(ERROR_MSG)
      const { logs } = await foreignBridge.methods['relayTokens(address,address,uint256)'](user, recipient, value, {
        from: user
      }).should.be.fulfilled

      // Then
      expect(await foreignBridge.totalSpentPerDay(currentDay)).to.be.bignumber.equal(value)
      expectEventInLogs(logs, 'UserRequestForAffirmation', {
        recipient,
        value
      })
    })
    it('should allow only sender to specify a different receiver', async () => {
      // Given
      const currentDay = await foreignBridge.getCurrentDay()
      expect(await foreignBridge.totalSpentPerDay(currentDay)).to.be.bignumber.equal(ZERO)

      await foreignBridge.methods['relayTokens(address,address,uint256)'](user, recipient, value, {
        from: user
      }).should.be.rejectedWith(ERROR_MSG)

      await token.approve(foreignBridge.address, oneEther, { from: user }).should.be.fulfilled

      // When
      await foreignBridge.methods['relayTokens(address,address,uint256)'](user, ZERO_ADDRESS, value, {
        from: user
      }).should.be.rejectedWith(ERROR_MSG)
      await foreignBridge.methods['relayTokens(address,address,uint256)'](user, foreignBridge.address, value, {
        from: user
      }).should.be.rejectedWith(ERROR_MSG)
      await foreignBridge.methods['relayTokens(address,address,uint256)'](user, recipient, 0, {
        from: user
      }).should.be.rejectedWith(ERROR_MSG)
      await foreignBridge.methods['relayTokens(address,address,uint256)'](user, recipient, value, {
        from: recipient
      }).should.be.rejectedWith(ERROR_MSG)
      const { logs } = await foreignBridge.methods['relayTokens(address,address,uint256)'](user, recipient, value, {
        from: user
      }).should.be.fulfilled
      const { logs: logsSecondTx } = await foreignBridge.methods['relayTokens(address,address,uint256)'](
        user,
        user,
        value,
        { from: recipient }
      ).should.be.fulfilled

      // Then
      expectEventInLogs(logs, 'UserRequestForAffirmation', {
        recipient,
        value
      })
      expectEventInLogs(logsSecondTx, 'UserRequestForAffirmation', {
        recipient: user,
        value
      })
    })
    it('should not be able to transfer more than limit', async () => {
      // Given
      const userSupply = ether('2')
      const bigValue = oneEther
      const smallValue = ether('0.001')
      const currentDay = await foreignBridge.getCurrentDay()
      expect(await foreignBridge.totalSpentPerDay(currentDay)).to.be.bignumber.equal(ZERO)

      await token.approve(foreignBridge.address, userSupply, { from: user }).should.be.fulfilled

      // When
      // value < minPerTx
      await foreignBridge.methods['relayTokens(address,address,uint256)'](user, recipient, smallValue, {
        from: user
      }).should.be.rejectedWith(ERROR_MSG)
      // value > maxPerTx
      await foreignBridge.methods['relayTokens(address,address,uint256)'](user, recipient, bigValue, {
        from: user
      }).should.be.rejectedWith(ERROR_MSG)

      await foreignBridge.methods['relayTokens(address,address,uint256)'](user, recipient, halfEther, { from: user })
        .should.be.fulfilled
      await foreignBridge.methods['relayTokens(address,address,uint256)'](user, recipient, halfEther, { from: user })
        .should.be.fulfilled
      // totalSpentPerDay > dailyLimit
      await foreignBridge.methods['relayTokens(address,address,uint256)'](user, recipient, halfEther, {
        from: user
      }).should.be.rejectedWith(ERROR_MSG)

      // Then
      expect(await foreignBridge.totalSpentPerDay(currentDay)).to.be.bignumber.equal(oneEther)
    })
    it('should allow to call relayTokens without specifying the sender', async () => {
      // Given
      await foreignBridge.methods['relayTokens(address,uint256)'](recipient, value, {
        from: user
      }).should.be.rejectedWith(ERROR_MSG)

      await token.approve(foreignBridge.address, value, { from: user }).should.be.fulfilled

      // When
      await foreignBridge.methods['relayTokens(address,uint256)'](ZERO_ADDRESS, value, {
        from: user
      }).should.be.rejectedWith(ERROR_MSG)
      await foreignBridge.methods['relayTokens(address,uint256)'](foreignBridge.address, value, {
        from: user
      }).should.be.rejectedWith(ERROR_MSG)
      await foreignBridge.methods['relayTokens(address,uint256)'](recipient, 0, { from: user }).should.be.rejectedWith(
        ERROR_MSG
      )
      const { logs } = await foreignBridge.methods['relayTokens(address,uint256)'](recipient, value, { from: user })
        .should.be.fulfilled

      // Then
      expectEventInLogs(logs, 'UserRequestForAffirmation', {
        recipient,
        value
      })
    })
  })
  describe('#relayTokens with chai', async () => {
    const user = accounts[7]
    const recipient = accounts[8]
    const value = ether('0.25')
    let foreignBridge
    let chaiToken
    beforeEach(async () => {
      foreignBridge = await ForeignBridgeErcToNativeMock.new()
      token = await DaiMock.new({ from: owner })
      chaiToken = (await createChaiToken(token, foreignBridge, owner)).chaiToken
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
      await token.mint(user, ether('2'))
    })

    it('should allow to bridge tokens with chai token enabled', async () => {
      await foreignBridge.methods['initializeChaiToken()']()
      expect(await chaiToken.balanceOf(foreignBridge.address)).to.be.bignumber.equal(ZERO)

      const currentDay = await foreignBridge.getCurrentDay()
      expect(await foreignBridge.totalSpentPerDay(currentDay)).to.be.bignumber.equal(ZERO)

      await foreignBridge.methods['relayTokens(address,address,uint256)'](user, recipient, value, {
        from: user
      }).should.be.rejectedWith(ERROR_MSG)

      await token.approve(foreignBridge.address, value, { from: user }).should.be.fulfilled

      await foreignBridge.methods['relayTokens(address,address,uint256)'](user, ZERO_ADDRESS, value, {
        from: user
      }).should.be.rejectedWith(ERROR_MSG)
      await foreignBridge.methods['relayTokens(address,address,uint256)'](user, foreignBridge.address, value, {
        from: user
      }).should.be.rejectedWith(ERROR_MSG)
      await foreignBridge.methods['relayTokens(address,address,uint256)'](user, user, 0, {
        from: user
      }).should.be.rejectedWith(ERROR_MSG)
      const { logs } = await foreignBridge.methods['relayTokens(address,address,uint256)'](user, user, value, {
        from: user
      }).should.be.fulfilled

      expect(await foreignBridge.totalSpentPerDay(currentDay)).to.be.bignumber.equal(value)
      expectEventInLogs(logs, 'UserRequestForAffirmation', {
        recipient: user,
        value
      })

      expect(await chaiToken.balanceOf(foreignBridge.address)).to.be.bignumber.equal(ZERO)
      expect(await token.balanceOf(foreignBridge.address)).to.be.bignumber.equal(value)
    })

    it('should allow to bridge tokens with chai token enabled, excess tokens', async () => {
      await foreignBridge.methods['initializeChaiToken()']()
      await token.mint(foreignBridge.address, ether('201'))
      expect(await chaiToken.balanceOf(foreignBridge.address)).to.be.bignumber.equal(ZERO)

      await token.approve(foreignBridge.address, value, { from: user }).should.be.fulfilled

      const { logs } = await foreignBridge.methods['relayTokens(address,address,uint256)'](user, user, value, {
        from: user
      }).should.be.fulfilled

      expectEventInLogs(logs, 'UserRequestForAffirmation', {
        recipient: user,
        value
      })

      expect(await chaiToken.balanceOf(foreignBridge.address)).to.be.bignumber.gt(ZERO)
      expect(await token.balanceOf(foreignBridge.address)).to.be.bignumber.equal(minDaiLimit)
    })
  })
  describe('migrateToMCD', () => {
    let foreignBridge
    beforeEach(async () => {
      foreignBridge = await ForeignBridgeErcToNativeMock.new()

      await foreignBridge.initialize(
        validatorContract.address,
        sai.address,
        requireBlockConfirmations,
        gasPrice,
        [dailyLimit, maxPerTx, minPerTx],
        [homeDailyLimit, homeMaxPerTx],
        owner,
        decimalShiftZero,
        otherSideBridge.address
      )

      // Mint the bridge some sai tokens
      await sai.mint(foreignBridge.address, oneEther)
    })
    it('should be able to swap tokens', async () => {
      // Given
      expect(await sai.balanceOf(foreignBridge.address)).to.be.bignumber.equal(oneEther)
      expect(await dai.balanceOf(foreignBridge.address)).to.be.bignumber.equal(ZERO)
      expect(await foreignBridge.erc20token()).to.be.equal(sai.address)

      // When

      const { logs } = await foreignBridge.migrateToMCD({ from: owner }).should.be.fulfilled

      // can't migrate token again
      await foreignBridge.migrateToMCD({ from: owner }).should.be.rejectedWith(ERROR_MSG)

      // Then
      expect(await sai.balanceOf(foreignBridge.address)).to.be.bignumber.equal(ZERO)
      expect(await dai.balanceOf(foreignBridge.address)).to.be.bignumber.equal(oneEther)
      expect(await foreignBridge.erc20token()).to.be.equal(dai.address)
      expect(await foreignBridge.minHDTokenBalance()).to.be.bignumber.equal(ether('10'))
      expectEventInLogs(logs, 'TokensSwapped', {
        from: sai.address,
        to: dai.address,
        value: oneEther
      })
      const transferEvent = await getEvents(dai, { event: 'Transfer' })

      // first transfer event was for minting to user in the top Before section
      expect(transferEvent.length).to.be.equal(2)
      expect(transferEvent[1].returnValues.from).to.be.equal(ZERO_ADDRESS)
      expect(transferEvent[1].returnValues.to).to.be.equal(foreignBridge.address)
      expect(transferEvent[1].returnValues.value).to.be.equal(oneEther.toString())
    })
  })
  describe('support two tokens', () => {
    let foreignBridge
    const recipient = accounts[8]
    beforeEach(async () => {
      foreignBridge = await ForeignBridgeErcToNativeMock.new()

      await foreignBridge.initialize(
        validatorContract.address,
        dai.address,
        requireBlockConfirmations,
        gasPrice,
        [dailyLimit, maxPerTx, minPerTx],
        [homeDailyLimit, homeMaxPerTx],
        owner,
        decimalShiftZero,
        otherSideBridge.address
      )

      // Mint sai tokens to a user
      await sai.mint(user, twoEthers)
    })
    describe('isTokenSwapAllowed', () => {
      it('isTokenSwapAllowed should return true if SCD ES was executed', async () => {
        // Given
        expect(await foreignBridge.isTokenSwapAllowed(100)).to.be.equal(true)

        // When
        await saiTop.setCaged(150)

        // Then
        expect(await foreignBridge.isTokenSwapAllowed(100)).to.be.equal(true)
        expect(await foreignBridge.isTokenSwapAllowed(150)).to.be.equal(true)
        expect(await foreignBridge.isTokenSwapAllowed(200)).to.be.equal(false)

        // reset the caged value
        await saiTop.setCaged(0)
      })
    })
    describe('isHDTokenBalanceAboveMinBalance', () => {
      it('isHDTokenBalanceAboveMinBalance should return true if balance above the threshold ', async () => {
        const threshold = halfEther
        // Given
        expect(await sai.balanceOf(foreignBridge.address)).to.be.bignumber.equal(ZERO)

        await foreignBridge.setMinHDTokenBalance(threshold)

        expect(await foreignBridge.minHDTokenBalance()).to.be.bignumber.equal(threshold)

        expect(await foreignBridge.isHDTokenBalanceAboveMinBalance()).to.be.equal(false)

        // When
        await sai.mint(foreignBridge.address, oneEther)

        // Then
        expect(await foreignBridge.isHDTokenBalanceAboveMinBalance()).to.be.equal(true)
      })
    })
    describe('halfDuplexErc20token', () => {
      it('should be able to get half duplex erc20 token', async () => {
        expect(await foreignBridge.halfDuplexErc20token()).to.be.equal(sai.address)
      })
    })
    describe('swapTokens', () => {
      it('should be able to swap tokens calling swapTokens', async () => {
        expect(await saiTop.caged()).to.be.bignumber.equal(ZERO)
        expect(await sai.balanceOf(foreignBridge.address)).to.be.bignumber.equal(ZERO)
        expect(await dai.balanceOf(foreignBridge.address)).to.be.bignumber.equal(ZERO)

        // should have sai balance
        await foreignBridge.swapTokens().should.be.rejectedWith(ERROR_MSG)

        // mint sai tokens to bridge
        await sai.mint(foreignBridge.address, oneEther)

        expect(await sai.balanceOf(foreignBridge.address)).to.be.bignumber.equal(oneEther)
        expect(await dai.balanceOf(foreignBridge.address)).to.be.bignumber.equal(ZERO)

        const { logs } = await foreignBridge.swapTokens()

        expect(await sai.balanceOf(foreignBridge.address)).to.be.bignumber.equal(ZERO)
        expect(await dai.balanceOf(foreignBridge.address)).to.be.bignumber.equal(oneEther)
        expect(await foreignBridge.erc20token()).to.be.equal(dai.address)
        expectEventInLogs(logs, 'TokensSwapped', {
          from: sai.address,
          to: dai.address,
          value: oneEther
        })

        // mint more sai tokens to bridge
        await sai.mint(foreignBridge.address, oneEther)

        expect(await sai.balanceOf(foreignBridge.address)).to.be.bignumber.equal(oneEther)
        expect(await dai.balanceOf(foreignBridge.address)).to.be.bignumber.equal(oneEther)

        await foreignBridge.swapTokens().should.be.fulfilled

        expect(await sai.balanceOf(foreignBridge.address)).to.be.bignumber.equal(ZERO)
        expect(await dai.balanceOf(foreignBridge.address)).to.be.bignumber.equal(twoEthers)

        const block = await web3.eth.getBlock('latest')
        // Trigger Emergency Shutdown
        await saiTop.setCaged(block.number)

        // mint sai tokens to bridge
        await sai.mint(foreignBridge.address, oneEther)

        expect(await sai.balanceOf(foreignBridge.address)).to.be.bignumber.equal(oneEther)
        expect(await dai.balanceOf(foreignBridge.address)).to.be.bignumber.equal(twoEthers)

        // should not be able to swap tokens after Emergency Shutdown
        await foreignBridge.swapTokens().should.be.rejectedWith(ERROR_MSG)

        // reset the caged value
        await saiTop.setCaged(0)
      })
    })
    describe('relayTokens', () => {
      const value = ether('0.25')
      it('should allow to bridge tokens specifying the token address', async () => {
        // Given
        const balance = await dai.balanceOf(user)
        const relayTokens = foreignBridge.methods['relayTokens(address,uint256,address)']

        const currentDay = await foreignBridge.getCurrentDay()
        expect(await foreignBridge.totalSpentPerDay(currentDay)).to.be.bignumber.equal(ZERO)

        await relayTokens(recipient, value, dai.address, { from: user }).should.be.rejectedWith(ERROR_MSG)

        await dai.approve(foreignBridge.address, value, { from: user }).should.be.fulfilled

        // When
        await relayTokens(ZERO_ADDRESS, value, dai.address, { from: user }).should.be.rejectedWith(ERROR_MSG)
        await relayTokens(foreignBridge.address, value, dai.address, { from: user }).should.be.rejectedWith(ERROR_MSG)
        await relayTokens(otherSideBridge.address, value, dai.address, { from: user }).should.be.rejectedWith(ERROR_MSG)
        await relayTokens(recipient, 0, dai.address, { from: user }).should.be.rejectedWith(ERROR_MSG)
        const { logs } = await relayTokens(recipient, value, dai.address, { from: user }).should.be.fulfilled

        // Then
        expect(await foreignBridge.totalSpentPerDay(currentDay)).to.be.bignumber.equal(value)
        expectEventInLogs(logs, 'UserRequestForAffirmation', {
          recipient,
          value
        })
        expect(await dai.balanceOf(user)).to.be.bignumber.equal(balance.sub(value))
      })
      it('should use erc20Token if token address is zero', async () => {
        // Given
        const balance = await dai.balanceOf(user)
        const relayTokens = foreignBridge.methods['relayTokens(address,uint256,address)']

        const currentDay = await foreignBridge.getCurrentDay()
        expect(await foreignBridge.totalSpentPerDay(currentDay)).to.be.bignumber.equal(ZERO)

        await dai.approve(foreignBridge.address, value, { from: user }).should.be.fulfilled

        // When
        const { logs } = await relayTokens(recipient, value, ZERO_ADDRESS, { from: user }).should.be.fulfilled

        // Then
        expect(await foreignBridge.totalSpentPerDay(currentDay)).to.be.bignumber.equal(value)
        expectEventInLogs(logs, 'UserRequestForAffirmation', {
          recipient,
          value
        })
        expect(await dai.balanceOf(user)).to.be.bignumber.equal(balance.sub(value))
      })
      it('should swap token if half duplex token is used', async () => {
        // Given
        const relayTokens = foreignBridge.methods['relayTokens(address,uint256,address)']

        const userBalance = await sai.balanceOf(user)
        expect(await sai.balanceOf(foreignBridge.address)).to.be.bignumber.equal(ZERO)
        expect(await dai.balanceOf(foreignBridge.address)).to.be.bignumber.equal(ZERO)
        const currentDay = await foreignBridge.getCurrentDay()
        expect(await foreignBridge.totalSpentPerDay(currentDay)).to.be.bignumber.equal(ZERO)

        await sai.approve(foreignBridge.address, value, { from: user }).should.be.fulfilled

        // When
        const { logs } = await relayTokens(recipient, value, sai.address, { from: user }).should.be.fulfilled

        // Then
        expect(await foreignBridge.totalSpentPerDay(currentDay)).to.be.bignumber.equal(value)
        expectEventInLogs(logs, 'UserRequestForAffirmation', {
          recipient,
          value
        })
        expectEventInLogs(logs, 'TokensSwapped', {
          from: sai.address,
          to: dai.address,
          value
        })
        expect(await sai.balanceOf(user)).to.be.bignumber.equal(userBalance.sub(value))
        expect(await sai.balanceOf(foreignBridge.address)).to.be.bignumber.equal(ZERO)
        expect(await dai.balanceOf(foreignBridge.address)).to.be.bignumber.equal(value)
      })
      it('should fail if token address is unknown', async () => {
        const otherToken = await ERC20Mock.new('token', 'TOK', 18)
        await otherToken.mint(user, twoEthers)

        const relayTokens = foreignBridge.methods['relayTokens(address,uint256,address)']

        await otherToken.approve(foreignBridge.address, value, { from: user }).should.be.fulfilled

        await relayTokens(recipient, value, otherToken.address, { from: user }).should.be.rejectedWith(ERROR_MSG)
      })
      it('should allow specify the sender and a different receiver', async () => {
        // Given
        const currentDay = await foreignBridge.getCurrentDay()
        expect(await foreignBridge.totalSpentPerDay(currentDay)).to.be.bignumber.equal(ZERO)
        const userBalance = await dai.balanceOf(user)

        const relayTokens = foreignBridge.methods['relayTokens(address,address,uint256,address)']

        await relayTokens(user, recipient, value, dai.address, { from: user }).should.be.rejectedWith(ERROR_MSG)

        await dai.approve(foreignBridge.address, halfEther, { from: user }).should.be.fulfilled

        // When
        await relayTokens(user, ZERO_ADDRESS, value, dai.address, { from: user }).should.be.rejectedWith(ERROR_MSG)
        await relayTokens(user, foreignBridge.address, value, dai.address, { from: user }).should.be.rejectedWith(
          ERROR_MSG
        )
        await relayTokens(user, recipient, 0, dai.address, { from: user }).should.be.rejectedWith(ERROR_MSG)
        await relayTokens(user, recipient, value, dai.address, { from: recipient }).should.be.rejectedWith(ERROR_MSG)
        const { logs } = await relayTokens(user, recipient, value, dai.address, { from: user }).should.be.fulfilled
        const { logs: logsSecondTx } = await relayTokens(user, user, value, dai.address, { from: recipient }).should.be
          .fulfilled

        // Then
        expectEventInLogs(logs, 'UserRequestForAffirmation', {
          recipient,
          value
        })
        expectEventInLogs(logsSecondTx, 'UserRequestForAffirmation', {
          recipient: user,
          value
        })
        expect(await foreignBridge.totalSpentPerDay(currentDay)).to.be.bignumber.equal(halfEther)
        expect(await dai.balanceOf(user)).to.be.bignumber.equal(userBalance.sub(halfEther))
        expect(await dai.balanceOf(foreignBridge.address)).to.be.bignumber.equal(halfEther)
      })
      it('should not be able to transfer more than limit', async () => {
        // Given
        const userSupply = ether('2')
        const bigValue = oneEther
        const smallValue = ether('0.001')
        const currentDay = await foreignBridge.getCurrentDay()
        expect(await foreignBridge.totalSpentPerDay(currentDay)).to.be.bignumber.equal(ZERO)

        const relayTokens = foreignBridge.methods['relayTokens(address,uint256,address)']

        await dai.approve(foreignBridge.address, userSupply, { from: user }).should.be.fulfilled

        // When
        // value < minPerTx
        await relayTokens(recipient, smallValue, dai.address, { from: user }).should.be.rejectedWith(ERROR_MSG)
        // value > maxPerTx
        await relayTokens(recipient, bigValue, dai.address, { from: user }).should.be.rejectedWith(ERROR_MSG)

        await relayTokens(recipient, halfEther, dai.address, { from: user }).should.be.fulfilled
        await relayTokens(recipient, halfEther, dai.address, { from: user }).should.be.fulfilled
        // totalSpentPerDay > dailyLimit
        await relayTokens(recipient, halfEther, dai.address, { from: user }).should.be.rejectedWith(ERROR_MSG)

        // Then
        expect(await foreignBridge.totalSpentPerDay(currentDay)).to.be.bignumber.equal(oneEther)
      })
    })
    describe('relayTokens with chai token', async () => {
      let foreignBridge
      let dai
      const value = ether('0.25')
      const recipient = accounts[8]
      beforeEach(async () => {
        dai = await DaiMock.new({ from: owner })
        foreignBridge = await ForeignBridgeErcToNativeMock.new()

        await foreignBridge.initialize(
          validatorContract.address,
          dai.address,
          requireBlockConfirmations,
          gasPrice,
          [dailyLimit, maxPerTx, minPerTx],
          [homeDailyLimit, homeMaxPerTx],
          owner,
          decimalShiftZero,
          otherSideBridge.address
        )

        await dai.mint(user, twoEthers)
      })

      it('should allow to bridge tokens specifying the token address with chai token enabled', async () => {
        // Given
        const { chaiToken } = await createChaiToken(dai, foreignBridge, owner)
        await foreignBridge.methods['initializeChaiToken()']()
        expect(await chaiToken.balanceOf(foreignBridge.address)).to.be.bignumber.equal(ZERO)

        const balance = await dai.balanceOf(user)
        const relayTokens = foreignBridge.methods['relayTokens(address,uint256,address)']

        const currentDay = await foreignBridge.getCurrentDay()
        expect(await foreignBridge.totalSpentPerDay(currentDay)).to.be.bignumber.equal(ZERO)

        await relayTokens(recipient, value, dai.address, { from: user }).should.be.rejectedWith(ERROR_MSG)

        await dai.approve(foreignBridge.address, value, { from: user }).should.be.fulfilled

        // When
        await relayTokens(ZERO_ADDRESS, value, dai.address, { from: user }).should.be.rejectedWith(ERROR_MSG)
        await relayTokens(foreignBridge.address, value, dai.address, { from: user }).should.be.rejectedWith(ERROR_MSG)
        await relayTokens(otherSideBridge.address, value, dai.address, { from: user }).should.be.rejectedWith(ERROR_MSG)
        await relayTokens(recipient, 0, dai.address, { from: user }).should.be.rejectedWith(ERROR_MSG)
        const { logs } = await relayTokens(recipient, value, dai.address, { from: user }).should.be.fulfilled

        // Then
        expect(await foreignBridge.totalSpentPerDay(currentDay)).to.be.bignumber.equal(value)
        expectEventInLogs(logs, 'UserRequestForAffirmation', {
          recipient,
          value
        })
        expect(await dai.balanceOf(user)).to.be.bignumber.equal(balance.sub(value))
        expect(await chaiToken.balanceOf(foreignBridge.address)).to.be.bignumber.equal(ZERO)
      })
    })
    describe('onExecuteMessage', () => {
      it('should swapTokens in executeSignatures', async () => {
        const value = ether('0.25')
        const recipientAccount = accounts[3]
        const balanceBefore = await dai.balanceOf(recipientAccount)

        // fund dai tokens
        await dai.transfer(foreignBridge.address, value, { from: user })

        // mint sai tokens to bridge
        await sai.mint(foreignBridge.address, halfEther)

        const transactionHash = '0x1045bfe274b88120a6b1e5d01b5ec00ab5d01098346e90e7c7a3c9b8f0181c80'
        const message = createMessage(recipientAccount, value, transactionHash, foreignBridge.address)
        const signature = await sign(authorities[0], message)
        const vrs = signatureToVRS(signature)
        const oneSignature = packSignatures([vrs])
        expect(await foreignBridge.relayedMessages(transactionHash)).to.be.equal(false)

        const { logs } = await foreignBridge.executeSignatures(message, oneSignature).should.be.fulfilled

        expectEventInLogs(logs, 'RelayedMessage', {
          recipient: recipientAccount,
          value
        })
        expectEventInLogs(logs, 'TokensSwapped', {
          from: sai.address,
          to: dai.address,
          value: halfEther
        })
        expect(await dai.balanceOf(recipientAccount)).to.be.bignumber.equal(balanceBefore.add(value))
        expect(await sai.balanceOf(foreignBridge.address)).to.be.bignumber.equal(ZERO)
        expect(await dai.balanceOf(foreignBridge.address)).to.be.bignumber.equal(halfEther)
        expect(await foreignBridge.relayedMessages(transactionHash)).to.be.equal(true)
      })
    })
    describe('claimTokens', async () => {
      it('can send erc20', async () => {
        const foreignBridgeImpl = await ForeignBridgeErcToNativeMock.new()
        const storageProxy = await EternalStorageProxy.new().should.be.fulfilled
        await storageProxy.upgradeTo('1', foreignBridgeImpl.address).should.be.fulfilled
        const foreignBridge = await ForeignBridgeErcToNativeMock.at(storageProxy.address)

        await foreignBridge.initialize(
          validatorContract.address,
          dai.address,
          requireBlockConfirmations,
          gasPrice,
          [dailyLimit, maxPerTx, minPerTx],
          [homeDailyLimit, homeMaxPerTx],
          owner,
          decimalShiftZero,
          otherSideBridge.address
        )

        expect(await saiTop.caged()).to.be.bignumber.equal(ZERO)

        // Mint sai tokens to the bridge
        await sai.mint(foreignBridge.address, halfEther)

        await foreignBridge.claimTokens(sai.address, accounts[3], { from: owner }).should.be.rejectedWith(ERROR_MSG)

        const block = await web3.eth.getBlock('latest')
        // Trigger Emergency Shutdown
        await saiTop.setCaged(block.number)

        expect(await sai.balanceOf(foreignBridge.address)).to.be.bignumber.equal(halfEther)
        expect(await sai.balanceOf(accounts[3])).to.be.bignumber.equal(ZERO)

        await foreignBridge
          .claimTokens(sai.address, accounts[3], { from: accounts[3] })
          .should.be.rejectedWith(ERROR_MSG)
        await foreignBridge.claimTokens(sai.address, accounts[3], { from: owner })
        expect(await sai.balanceOf(foreignBridge.address)).to.be.bignumber.equal(ZERO)
        expect(await sai.balanceOf(accounts[3])).to.be.bignumber.equal(halfEther)

        // reset the caged value
        await saiTop.setCaged(0)
      })
    })
  })

  describe('chai token', async () => {
    let token
    let foreignBridge
    let chaiToken
    let pot
    let interestRecipient

    beforeEach(async () => {
      token = await DaiMock.new({ from: owner })
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
      const chaiContracts = await createChaiToken(token, foreignBridge, owner)
      chaiToken = chaiContracts.chaiToken
      pot = chaiContracts.pot
      interestRecipient = await InterestReceiverMock.new({ from: owner })
      await interestRecipient.initialize(accounts[3], { from: owner })
      await interestRecipient.setChaiToken(chaiToken.address)
      await token.transfer(ZERO_ADDRESS, await token.balanceOf(accounts[3]), { from: accounts[3] })
    })

    describe('initializeChaiToken', () => {
      it('should be initialized', async () => {
        await foreignBridge.methods['initializeChaiToken()']().should.be.fulfilled
      })

      it('should fail to initialize twice', async () => {
        await foreignBridge.methods['initializeChaiToken()']().should.be.fulfilled
        await foreignBridge.methods['initializeChaiToken()']().should.be.rejected
      })

      it('should fail if not an owner', async () => {
        await foreignBridge.methods['initializeChaiToken()']({ from: accounts[1] }).should.be.rejected
      })
    })

    describe('initializeChaiToken with interest receiver', () => {
      it('should be initialized', async () => {
        await foreignBridge.methods['initializeChaiToken(address)'](accounts[3]).should.be.fulfilled
      })

      it('should fail to initialize twice', async () => {
        await foreignBridge.methods['initializeChaiToken(address)'](accounts[3]).should.be.fulfilled
        await foreignBridge.methods['initializeChaiToken(address)'](accounts[3]).should.be.rejected
      })

      it('should fail if not an owner', async () => {
        await foreignBridge.methods['initializeChaiToken(address)'](accounts[3], { from: accounts[1] }).should.be
          .rejected
      })

      it('should fail if zero address', async () => {
        await foreignBridge.methods['initializeChaiToken(address)'](ZERO_ADDRESS, { from: accounts[1] }).should.be
          .rejected
      })
    })

    describe('chaiTokenEnabled', () => {
      it('should return false', async () => {
        expect(await foreignBridge.isChaiTokenEnabled()).to.be.equal(false)
      })

      it('should return true', async () => {
        await foreignBridge.methods['initializeChaiToken()']().should.be.fulfilled
        expect(await foreignBridge.isChaiTokenEnabled()).to.be.equal(true)
      })
    })

    describe('removeChaiToken', () => {
      beforeEach(async () => {
        await foreignBridge.methods['initializeChaiToken()']().should.be.fulfilled
        await foreignBridge.setInterestReceiver(interestRecipient.address).should.be.fulfilled
      })

      it('should be removed', async () => {
        expect(await foreignBridge.isChaiTokenEnabled()).to.be.equal(true)
        await foreignBridge.removeChaiToken().should.be.fulfilled
        expect(await foreignBridge.isChaiTokenEnabled()).to.be.equal(false)
        expect(await chaiToken.balanceOf(foreignBridge.address)).to.be.bignumber.equal(ZERO)
      })

      it('should be removed with tokens withdraw', async () => {
        await token.mint(foreignBridge.address, oneEther, { from: owner })
        await foreignBridge.setMinDaiTokenBalance(ether('0.1'), { from: owner })
        await foreignBridge.convertDaiToChai()
        expect(await foreignBridge.isChaiTokenEnabled()).to.be.equal(true)

        await delay(1500)

        await foreignBridge.removeChaiToken().should.be.fulfilled
        expect(await foreignBridge.isChaiTokenEnabled()).to.be.equal(false)
        expect(await chaiToken.balanceOf(foreignBridge.address)).to.be.bignumber.equal(ZERO)
        expect(await token.balanceOf(interestRecipient.address)).to.be.bignumber.gt(ZERO)
        expect(await token.balanceOf(foreignBridge.address)).to.be.bignumber.gte(halfEther)
      })

      it('should fail if not an owner', async () => {
        await foreignBridge.removeChaiToken({ from: accounts[1] }).should.be.rejected
        await foreignBridge.removeChaiToken({ from: owner }).should.be.fulfilled
      })

      it('should fail if chai token is not enabled', async () => {
        await foreignBridge.removeChaiToken({ from: owner }).should.be.fulfilled
        await foreignBridge.removeChaiToken({ from: owner }).should.be.rejected
      })
    })

    describe('min dai limit', () => {
      beforeEach(async () => {
        await foreignBridge.methods['initializeChaiToken()']({ from: owner })
      })

      it('should return minDaiTokenBalance', async () => {
        expect(await foreignBridge.minDaiTokenBalance()).to.be.bignumber.equal(minDaiLimit)
      })

      it('should update minDaiTokenBalance', async () => {
        await foreignBridge.setMinDaiTokenBalance(ether('101'), { from: owner }).should.be.fulfilled
        expect(await foreignBridge.minDaiTokenBalance()).to.be.bignumber.equal(ether('101'))
      })

      it('should fail to update if not an owner', async () => {
        await foreignBridge.setMinDaiTokenBalance(ether('101'), { from: accounts[1] }).should.be.rejected
      })
    })

    describe('interestReceiver', () => {
      beforeEach(async () => {
        await foreignBridge.methods['initializeChaiToken()']({ from: owner })
      })

      it('should return interestReceiver', async () => {
        expect(await foreignBridge.interestReceiver()).to.be.equal(ZERO_ADDRESS)
      })

      it('should update interestReceiver', async () => {
        await foreignBridge.setInterestReceiver(interestRecipient.address, { from: owner }).should.be.fulfilled
        expect(await foreignBridge.interestReceiver()).to.be.equal(interestRecipient.address)
      })

      it('should fail to setInterestReceiver if not an owner', async () => {
        await foreignBridge.setInterestReceiver(interestRecipient.address, { from: accounts[1] }).should.be.rejected
      })

      it('should fail to setInterestReceiver if receiver is bridge address', async () => {
        await foreignBridge.setInterestReceiver(foreignBridge.address, { from: owner }).should.be.rejected
      })
    })

    describe('interestCollectionPeriod', () => {
      beforeEach(async () => {
        await foreignBridge.methods['initializeChaiToken()']({ from: owner })
      })

      it('should return interestCollectionPeriod', async () => {
        expect(await foreignBridge.interestCollectionPeriod()).to.be.bignumber.gt(ZERO)
      })

      it('should update interestCollectionPeriod', async () => {
        await foreignBridge.setInterestCollectionPeriod('100', { from: owner }).should.be.fulfilled
        expect(await foreignBridge.interestCollectionPeriod()).to.be.bignumber.equal('100')
      })

      it('should fail to setInterestCollectionPeriod if not an owner', async () => {
        await foreignBridge.setInterestCollectionPeriod('100', { from: accounts[1] }).should.be.rejected
      })
    })

    describe('isDaiNeedsToBeInvested', () => {
      it('should return false on empty balance', async () => {
        await foreignBridge.methods['initializeChaiToken()']()
        expect(await foreignBridge.isDaiNeedsToBeInvested()).to.be.equal(false)
      })

      it('should return false on insufficient balance', async () => {
        await foreignBridge.methods['initializeChaiToken()']()
        await token.mint(foreignBridge.address, ether('101'), { from: owner })
        expect(await foreignBridge.isDaiNeedsToBeInvested()).to.be.equal(false)
      })

      it('should return true on sufficient balance', async () => {
        await foreignBridge.methods['initializeChaiToken()']()
        await token.mint(foreignBridge.address, ether('201'), { from: owner })
        expect(await foreignBridge.isDaiNeedsToBeInvested()).to.be.equal(true)
      })

      it('should return false if chai token is not defined', async () => {
        await token.mint(foreignBridge.address, ether('201'), { from: owner })
        expect(await foreignBridge.isDaiNeedsToBeInvested()).to.be.equal(false)
      })
    })

    describe('convertDaiToChai', () => {
      it('should convert all dai except defined limit', async () => {
        await foreignBridge.methods['initializeChaiToken()']()
        await token.mint(foreignBridge.address, ether('101'))
        const { logs } = await foreignBridge.convertDaiToChai({ from: accounts[1] }).should.be.fulfilled

        logs[0].event.should.be.equal('TokensSwapped')
        logs[0].args.from.should.be.equal(token.address)
        logs[0].args.to.should.be.equal(chaiToken.address)
        logs[0].args.value.should.be.bignumber.equal(ether('1'))

        expect(await token.balanceOf(foreignBridge.address)).to.be.bignumber.equal(ether('100'))
        expect(await chaiToken.balanceOf(foreignBridge.address)).to.be.bignumber.gt(ZERO)
      })

      it('should not allow to convert if chai token is disabled', async () => {
        await token.mint(foreignBridge.address, ether('101'))
        await foreignBridge.convertDaiToChai({ from: owner }).should.be.rejected
      })
    })

    describe('_convertChaiToDai', async () => {
      beforeEach(async () => {
        await foreignBridge.methods['initializeChaiToken()']()
        await token.mint(foreignBridge.address, ether('5'))
        await foreignBridge.setMinDaiTokenBalance(ether('1'), { from: owner })
        await foreignBridge.convertDaiToChai()

        await delay(1500)

        expect(await token.balanceOf(foreignBridge.address)).to.be.bignumber.equal(ether('1'))
        expect(await foreignBridge.investedAmountInDai()).to.be.bignumber.equal(ether('4'))
        expect(await chaiToken.balanceOf(foreignBridge.address)).to.be.bignumber.gt(ether('3.9'))
      })

      it('should handle 0 amount', async () => {
        const { logs } = await foreignBridge.convertChaiToDai('0', { from: accounts[1] }).should.be.fulfilled

        expect(logs.length).to.be.equal(0)

        expect(await token.balanceOf(foreignBridge.address)).to.be.bignumber.equal(ether('1'))
        expect(await foreignBridge.investedAmountInDai()).to.be.bignumber.equal(ether('4'))
        expect(await chaiToken.balanceOf(foreignBridge.address)).to.be.bignumber.gt(ether('3.9'))
      })

      it('should handle overestimated amount', async () => {
        const { logs } = await foreignBridge.convertChaiToDai(ether('10'), { from: accounts[1] }).should.be.fulfilled

        logs[0].event.should.be.equal('TokensSwapped')
        logs[0].args.from.should.be.equal(chaiToken.address)
        logs[0].args.to.should.be.equal(token.address)
        logs[0].args.value.should.be.bignumber.equal(ether('4'))

        expect(await token.balanceOf(foreignBridge.address)).to.be.bignumber.equal(ether('5'))
        expect(await foreignBridge.investedAmountInDai()).to.be.bignumber.equal(ether('0'))
        expect(await chaiToken.balanceOf(foreignBridge.address)).to.be.bignumber.lt(ether('0.1'))
      })

      it('should handle amount == invested', async () => {
        const { logs } = await foreignBridge.convertChaiToDai(ether('4'), { from: accounts[1] }).should.be.fulfilled

        logs[0].event.should.be.equal('TokensSwapped')
        logs[0].args.from.should.be.equal(chaiToken.address)
        logs[0].args.to.should.be.equal(token.address)
        logs[0].args.value.should.be.bignumber.equal(ether('4'))

        expect(await token.balanceOf(foreignBridge.address)).to.be.bignumber.equal(ether('5'))
        expect(await foreignBridge.investedAmountInDai()).to.be.bignumber.equal(ether('0'))
        expect(await chaiToken.balanceOf(foreignBridge.address)).to.be.bignumber.lt(ether('0.1'))
      })

      it('should handle 0 < amount < invested', async () => {
        const { logs } = await foreignBridge.convertChaiToDai(ether('3'), { from: accounts[1] }).should.be.fulfilled

        logs[0].event.should.be.equal('TokensSwapped')
        logs[0].args.from.should.be.equal(chaiToken.address)
        logs[0].args.to.should.be.equal(token.address)
        logs[0].args.value.should.be.bignumber.equal(ether('3'))

        expect(await token.balanceOf(foreignBridge.address)).to.be.bignumber.equal(ether('4'))
        expect(await foreignBridge.investedAmountInDai()).to.be.bignumber.equal(ether('1'))
        expect(await chaiToken.balanceOf(foreignBridge.address)).to.be.bignumber.gt(ether('0.9'))
      })
    })

    describe('payInterest', () => {
      beforeEach(async () => {
        await foreignBridge.methods['initializeChaiToken()']()
        await token.mint(foreignBridge.address, halfEther)
        await foreignBridge.setMinDaiTokenBalance(ether('0.1'), { from: owner })
        await foreignBridge.convertDaiToChai()

        await delay(1500)
      })

      it('should pay full interest to regular account', async () => {
        await foreignBridge.setInterestReceiver(accounts[2], { from: owner })
        expect(await token.balanceOf(foreignBridge.address)).to.be.bignumber.equal(ether('0.1'))
        expect(await chaiToken.balanceOf(foreignBridge.address)).to.be.bignumber.gt(ZERO)
        expect(await token.balanceOf(accounts[2])).to.be.bignumber.equal(ZERO)
        expect(await foreignBridge.lastInterestPayment()).to.be.bignumber.equal(ZERO)

        const { logs } = await foreignBridge.payInterest({ from: accounts[1] }).should.be.fulfilled
        expectEventInLogs(logs, 'PaidInterest', {
          to: accounts[2]
        })

        expect(await foreignBridge.lastInterestPayment()).to.be.bignumber.gt(ZERO)
        expect(await chaiToken.balanceOf(accounts[2])).to.be.bignumber.gt(ZERO)
        expect(await chaiToken.balanceOf(foreignBridge.address)).to.be.bignumber.gt(ZERO)
        expect(await foreignBridge.dsrBalance()).to.be.bignumber.gte(ether('0.4'))
      })

      it('should pay full interest to contract', async () => {
        await foreignBridge.setInterestReceiver(interestRecipient.address, { from: owner })
        expect(await token.balanceOf(foreignBridge.address)).to.be.bignumber.equal(ether('0.1'))
        expect(await chaiToken.balanceOf(foreignBridge.address)).to.be.bignumber.gt(ZERO)
        expect(await token.balanceOf(interestRecipient.address)).to.be.bignumber.equal(ZERO)
        expect(await foreignBridge.lastInterestPayment()).to.be.bignumber.equal(ZERO)

        const { logs } = await foreignBridge.payInterest({ from: accounts[1] }).should.be.fulfilled
        expectEventInLogs(logs, 'PaidInterest', {
          to: interestRecipient.address
        })

        expect(await token.balanceOf(interestRecipient.address)).to.be.bignumber.gt(ZERO)

        await interestRecipient.withdraw(accounts[3], { from: accounts[3] }).should.be.fulfilled

        expect(await foreignBridge.lastInterestPayment()).to.be.bignumber.gt(ZERO)
        expect(await token.balanceOf(interestRecipient.address)).to.be.bignumber.equal(ZERO)
        expect(await token.balanceOf(accounts[3])).to.be.bignumber.gt(ZERO)
        expect(await chaiToken.balanceOf(foreignBridge.address)).to.be.bignumber.gt(ZERO)
        expect(await foreignBridge.dsrBalance()).to.be.bignumber.gte(ether('0.4'))
      })

      it('should not allow not pay interest twice within short time period', async () => {
        await foreignBridge.setInterestReceiver(interestRecipient.address, { from: owner })

        await foreignBridge.payInterest({ from: accounts[1] }).should.be.fulfilled

        await delay(1500)

        await foreignBridge.payInterest({ from: accounts[1] }).should.be.rejected
      })

      it('should allow to pay interest after some time', async () => {
        await foreignBridge.setInterestCollectionPeriod('5', { from: owner }) // 5 seconds
        await foreignBridge.setInterestReceiver(interestRecipient.address, { from: owner })

        await foreignBridge.payInterest({ from: accounts[1] }).should.be.fulfilled

        await delay(1500)

        await foreignBridge.payInterest({ from: accounts[1] }).should.be.rejected

        await delay(5000)

        await foreignBridge.payInterest({ from: accounts[1] }).should.be.fulfilled
      })

      it('should not allow to pay interest if chaiToken is disabled', async () => {
        await foreignBridge.setInterestReceiver(interestRecipient.address, { from: owner })
        await foreignBridge.removeChaiToken({ from: owner })

        await foreignBridge.payInterest().should.be.rejected
      })

      it('should not pay interest on empty address', async () => {
        await foreignBridge.payInterest().should.be.rejected
      })
    })

    describe('payInterest for upgradeabilityOwner', () => {
      it('should allow to pay interest without time restrictions', async () => {
        let foreignBridgeProxy = await EternalStorageProxy.new({ from: accounts[2] }).should.be.fulfilled
        await foreignBridgeProxy.upgradeTo('1', foreignBridge.address, { from: accounts[2] }).should.be.fulfilled
        foreignBridgeProxy = await ForeignBridgeErcToNativeMock.at(foreignBridgeProxy.address)
        foreignBridgeProxy.setChaiToken(chaiToken.address)
        await foreignBridgeProxy.initialize(
          validatorContract.address,
          token.address,
          requireBlockConfirmations,
          gasPrice,
          [dailyLimit, maxPerTx, minPerTx],
          [homeDailyLimit, homeMaxPerTx],
          owner,
          decimalShiftZero,
          otherSideBridge.address,
          { from: accounts[2] }
        )

        await foreignBridgeProxy.methods['initializeChaiToken()']()
        await token.mint(foreignBridgeProxy.address, halfEther)
        await foreignBridgeProxy.setMinDaiTokenBalance(ether('0.1'), { from: owner })
        await foreignBridgeProxy.convertDaiToChai()
        await foreignBridgeProxy.setInterestReceiver(interestRecipient.address, { from: owner })

        await delay(1500)

        await foreignBridgeProxy.payInterest({ from: accounts[2] }).should.be.fulfilled

        await delay(1500)

        await foreignBridgeProxy.payInterest({ from: accounts[2] }).should.be.fulfilled

        expect(await foreignBridgeProxy.lastInterestPayment()).to.be.bignumber.gt(ZERO)
        expect(await token.balanceOf(interestRecipient.address)).to.be.bignumber.gt(ZERO)
        expect(await chaiToken.balanceOf(foreignBridgeProxy.address)).to.be.bignumber.gt(ZERO)
        expect(await foreignBridgeProxy.dsrBalance()).to.be.bignumber.gte(ether('0.4'))
      })
    })

    describe('claimTokens', async () => {
      let foreignBridgeProxy

      beforeEach(async () => {
        foreignBridgeProxy = await EternalStorageProxy.new({ from: accounts[2] }).should.be.fulfilled
        await foreignBridgeProxy.upgradeTo('1', foreignBridge.address, { from: accounts[2] }).should.be.fulfilled
        foreignBridgeProxy = await ForeignBridgeErcToNativeMock.at(foreignBridgeProxy.address)
        foreignBridgeProxy.setChaiToken(chaiToken.address)
        await foreignBridgeProxy.initialize(
          validatorContract.address,
          token.address,
          requireBlockConfirmations,
          gasPrice,
          [dailyLimit, maxPerTx, minPerTx],
          [homeDailyLimit, homeMaxPerTx],
          owner,
          decimalShiftZero,
          otherSideBridge.address,
          { from: accounts[2] }
        )
      })

      it('should not allow to claim Chai, if it is enabled', async () => {
        await foreignBridgeProxy.methods['initializeChaiToken()']({ from: owner })
        await token.mint(foreignBridgeProxy.address, halfEther)
        await foreignBridgeProxy.setMinDaiTokenBalance(ether('0.1'), { from: owner })
        await foreignBridgeProxy.convertDaiToChai()
        expect(await foreignBridgeProxy.isChaiTokenEnabled()).to.be.equal(true)

        await foreignBridgeProxy.claimTokens(chaiToken.address, accounts[2], { from: accounts[2] }).should.be.rejected
      })

      it('should allow to claim chai after it is disabled', async () => {
        expect(await foreignBridgeProxy.isChaiTokenEnabled()).to.be.equal(false)
        await token.mint(accounts[3], halfEther)
        await token.approve(chaiToken.address, halfEther, { from: accounts[3] })
        await chaiToken.join(accounts[3], halfEther, { from: accounts[3] }).should.be.fulfilled

        await foreignBridgeProxy.claimTokens(chaiToken.address, accounts[2], { from: accounts[2] }).should.be.fulfilled
      })
    })

    describe('interestReceiver', async () => {
      describe('claimTokens', async () => {
        it('should allow to claim tokens from recipient account', async () => {
          const tokenSecond = await ERC677BridgeToken.new('Second token', 'TST2', 18)

          await tokenSecond.mint(accounts[0], halfEther).should.be.fulfilled
          expect(await tokenSecond.balanceOf(accounts[0])).to.be.bignumber.equal(halfEther)

          await tokenSecond.transfer(interestRecipient.address, halfEther)
          expect(await tokenSecond.balanceOf(accounts[0])).to.be.bignumber.equal(ZERO)
          expect(await tokenSecond.balanceOf(interestRecipient.address)).to.be.bignumber.equal(halfEther)

          await interestRecipient.claimTokens(tokenSecond.address, accounts[3], { from: accounts[1] }).should.be
            .rejected
          await interestRecipient.claimTokens(tokenSecond.address, accounts[3], { from: accounts[3] }).should.be
            .fulfilled
          expect(await tokenSecond.balanceOf(interestRecipient.address)).to.be.bignumber.equal(ZERO)
          expect(await tokenSecond.balanceOf(accounts[3])).to.be.bignumber.equal(halfEther)
        })

        it('should not allow to claim tokens for chai token', async () => {
          await interestRecipient.claimTokens(chaiToken.address, accounts[3], { from: accounts[3] }).should.be.rejected
        })

        it('should not allow to claim tokens for dai token', async () => {
          await interestRecipient.claimTokens(token.address, accounts[3], { from: accounts[3] }).should.be.rejected
        })
      })
    })

    describe('Zero DSR', async () => {
      beforeEach(async () => {
        await foreignBridge.setExecutionDailyLimit(ether('100'))
        await foreignBridge.methods['initializeChaiToken()']()
        await foreignBridge.setMinDaiTokenBalance(ether('0.1')).should.be.fulfilled
        await foreignBridge.setInterestReceiver(accounts[2]).should.be.fulfilled

        await pot.methods['file(bytes32,uint256)']('0x647372', '2111111111111111111111111111').should.be.fulfilled

        await delay(3000) // wait for some non-trivial chi

        await pot.methods['file(bytes32,uint256)']('0x647372', '1000000021979553151239153028').should.be.fulfilled
      })

      it('should allow to executeSignatures when DSR is zero', async () => {
        await token.mint(foreignBridge.address, ether('10')).should.be.fulfilled

        await pot.methods['file(bytes32,uint256)']('0x647372', '1000000000000000000000000000').should.be.fulfilled
        await foreignBridge.convertDaiToChai().should.be.fulfilled

        expect(await foreignBridge.dsrBalance()).to.be.bignumber.lt(ether('9.9'))

        await delay(1500)

        for (let i = 0; i < 10; i++) {
          const transactionHash = `0x${i}045bfe274b88120a6b1e5d01b5ec00ab5d01098346e90e7c7a3c9b8f0181c80`
          const message = createMessage(accounts[1], ether('0.25'), transactionHash, foreignBridge.address)
          const signature = await sign(authorities[0], message)
          const oneSignature = packSignatures([signatureToVRS(signature)])

          await foreignBridge.executeSignatures(message, oneSignature).should.be.fulfilled
        }

        expect(await foreignBridge.dsrBalance()).to.be.bignumber.lt(ether('7.4'))
      })

      it('should allow to executeSignatures when DSR is zero with many conversions', async () => {
        await token.mint(foreignBridge.address, halfEther).should.be.fulfilled

        await pot.methods['file(bytes32,uint256)']('0x647372', '1000000000000000000000000000').should.be.fulfilled
        await foreignBridge.convertDaiToChai().should.be.fulfilled

        expect(await foreignBridge.dsrBalance()).to.be.bignumber.lt(ether('0.4'))

        await delay(1500)

        for (let i = 0; i < 10; i++) {
          await token.mint(foreignBridge.address, ether('0.25')).should.be.fulfilled
          await foreignBridge.convertDaiToChai().should.be.fulfilled

          const transactionHash = `0x${i}045bfe274b88120a6b1e5d01b5ec00ab5d01098346e90e7c7a3c9b8f0181c80`
          const message = createMessage(accounts[1], ether('0.25'), transactionHash, foreignBridge.address)
          const signature = await sign(authorities[0], message)
          const oneSignature = packSignatures([signatureToVRS(signature)])

          await foreignBridge.executeSignatures(message, oneSignature).should.be.fulfilled
        }

        expect(await foreignBridge.dsrBalance()).to.be.bignumber.lt(ether('0.4'))
      })

      it('should allow to executeSignatures after pay interest', async () => {
        await token.mint(foreignBridge.address, ether('10')).should.be.fulfilled

        await pot.methods['file(bytes32,uint256)']('0x647372', '1111111111111111111111111111').should.be.fulfilled

        await delay(1500)

        await foreignBridge.convertDaiToChai().should.be.fulfilled

        await delay(3000) // wait for some interest

        await pot.methods['file(bytes32,uint256)']('0x647372', '1000000000000000000000000000').should.be.fulfilled

        expect(await foreignBridge.dsrBalance()).to.be.bignumber.gt(ether('13'))

        await delay(1500)

        await foreignBridge.payInterest().should.be.fulfilled

        expect(await foreignBridge.dsrBalance()).to.be.bignumber.gte(ether('9.9'))

        for (let i = 0; i < 10; i++) {
          const transactionHash = `0x${i}045bfe274b88120a6b1e5d01b5ec00ab5d01098346e90e7c7a3c9b8f0181c80`
          const message = createMessage(accounts[1], ether('0.25'), transactionHash, foreignBridge.address)
          const signature = await sign(authorities[0], message)
          const oneSignature = packSignatures([signatureToVRS(signature)])

          await foreignBridge.executeSignatures(message, oneSignature).should.be.fulfilled
        }

        expect(await foreignBridge.dsrBalance()).to.be.bignumber.lt(ether('7.4'))
      })
    })
  })
})
