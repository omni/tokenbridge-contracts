const ForeignBridge = artifacts.require('ForeignBridgeErcToNative.sol')
const BridgeValidators = artifacts.require('BridgeValidators.sol')
const EternalStorageProxy = artifacts.require('EternalStorageProxy.sol')
const ERC677BridgeToken = artifacts.require('ERC677BridgeToken.sol')
const ERC20Mock = artifacts.require('ERC20Mock.sol')
const ForeignBridgeErcToNativeMock = artifacts.require('ForeignBridgeErcToNativeMock.sol')

const { expect } = require('chai')
const { ERROR_MSG, ZERO_ADDRESS, toBN } = require('../setup')
const {
  createMessage,
  sign,
  signatureToVRS,
  ether,
  expectEventInLogs,
  createFullAccounts,
  packSignatures
} = require('../helpers/helpers')
const getCompoundContracts = require('../compound/contracts')

const halfEther = ether('0.5')
const requireBlockConfirmations = 8
const gasPrice = web3.utils.toWei('1', 'gwei')
const oneEther = ether('1')
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

contract('ForeignBridge_ERC20_to_Native', async accounts => {
  let validatorContract
  let authorities
  let owner
  let token
  let otherSideBridge
  let dai
  const user = accounts[7]
  before(async () => {
    validatorContract = await BridgeValidators.new()
    authorities = [accounts[1], accounts[2]]
    owner = accounts[0]
    await validatorContract.initialize(1, authorities, owner)
    otherSideBridge = await ForeignBridge.new()

    dai = await ERC20Mock.new('dai', 'DAI', 18)

    await dai.mint(user, ether('100000'))
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

      // not valid decimal shift
      await foreignBridge.initialize(
        validatorContract.address,
        token.address,
        requireBlockConfirmations,
        gasPrice,
        [dailyLimit, maxPerTx, minPerTx],
        [homeDailyLimit, homeMaxPerTx],
        owner,
        '100',
        otherSideBridge.address
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
      const foreignImplV2 = await ForeignBridge.new()
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
    for (const decimalShift of [2, -1]) {
      it(`Home to Foreign: withdraw with 1 signature with a decimalShift of ${decimalShift}`, async () => {
        // From a foreign a token erc token 16 decimals.
        const token = await ERC677BridgeToken.new('Some ERC20', 'RSZT', 16)
        const valueOnForeign = toBN('1000')
        // Value is decimals shifted from foreign to home: Native on home = 16+2 shift = 18 decimals
        const valueOnHome = toBN(valueOnForeign * 10 ** decimalShift)

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
          decimalShift,
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

      it(`Home to Foreign: withdraw with 2 minimum signatures with a decimalShift of ${decimalShift}`, async () => {
        const multisigValidatorContract = await BridgeValidators.new()
        const valueOnForeign = toBN('1000')
        const valueOnHome = toBN(valueOnForeign * 10 ** decimalShift)
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
          decimalShift,
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
    }
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

      await foreignBridge
        .relayTokens(recipient, value, {
          from: user
        })
        .should.be.rejectedWith(ERROR_MSG)

      await token.approve(foreignBridge.address, value, { from: user }).should.be.fulfilled

      // When
      await foreignBridge
        .relayTokens(ZERO_ADDRESS, value, {
          from: user
        })
        .should.be.rejectedWith(ERROR_MSG)
      await foreignBridge
        .relayTokens(foreignBridge.address, value, {
          from: user
        })
        .should.be.rejectedWith(ERROR_MSG)
      await foreignBridge
        .relayTokens(user, 0, {
          from: user
        })
        .should.be.rejectedWith(ERROR_MSG)
      const { logs } = await foreignBridge.relayTokens(user, value, {
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

      await foreignBridge
        .relayTokens(recipient, value, {
          from: user
        })
        .should.be.rejectedWith(ERROR_MSG)

      await token.approve(foreignBridge.address, value, { from: user }).should.be.fulfilled

      await foreignBridge
        .relayTokens(recipient, 0, {
          from: user
        })
        .should.be.rejectedWith(ERROR_MSG)
      const { logs } = await foreignBridge.relayTokens(recipient, value, {
        from: user
      }).should.be.fulfilled

      // Then
      expect(await foreignBridge.totalSpentPerDay(currentDay)).to.be.bignumber.equal(value)
      expectEventInLogs(logs, 'UserRequestForAffirmation', {
        recipient,
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
      await foreignBridge
        .relayTokens(recipient, smallValue, {
          from: user
        })
        .should.be.rejectedWith(ERROR_MSG)
      // value > maxPerTx
      await foreignBridge
        .relayTokens(recipient, bigValue, {
          from: user
        })
        .should.be.rejectedWith(ERROR_MSG)

      await foreignBridge.relayTokens(recipient, halfEther, { from: user }).should.be.fulfilled
      await foreignBridge.relayTokens(recipient, halfEther, { from: user }).should.be.fulfilled
      // totalSpentPerDay > dailyLimit
      await foreignBridge
        .relayTokens(recipient, halfEther, {
          from: user
        })
        .should.be.rejectedWith(ERROR_MSG)

      // Then
      expect(await foreignBridge.totalSpentPerDay(currentDay)).to.be.bignumber.equal(oneEther)
    })
  })

  describe('compound connector', () => {
    const faucet = accounts[6] // account where all Compound-related DAIs where minted

    let dai
    let cDai
    let comptroller
    let comp
    let foreignBridge

    before(async () => {
      const contracts = await getCompoundContracts()
      dai = contracts.dai
      cDai = contracts.cDai
      comptroller = contracts.comptroller
      comp = contracts.comp
    })

    beforeEach(async () => {
      foreignBridge = await ForeignBridgeErcToNativeMock.new()
      await foreignBridge.initialize(
        validatorContract.address,
        dai.address,
        requireBlockConfirmations,
        gasPrice,
        [ether('1000000'), ether('100000'), minPerTx],
        [homeDailyLimit, homeMaxPerTx],
        owner,
        decimalShiftZero,
        otherSideBridge.address
      )
      await dai.approve(foreignBridge.address, ether('100'), { from: faucet })
      await foreignBridge.relayTokens(faucet, ether('10'), { from: faucet })
    })

    async function generateInterest() {
      await cDai.borrow(ether('10'), { from: faucet }).should.be.fulfilled
      await comptroller.fastForward(200000).should.be.fulfilled
      await cDai.repayBorrow(ether('20'), { from: faucet }).should.be.fulfilled
    }

    it('should initialize interest', async () => {
      expect(await dai.balanceOf(foreignBridge.address)).to.be.bignumber.equal(ether('10'))
      expect(await foreignBridge.isInterestEnabled(dai.address)).to.be.equal(false)

      const args = [dai.address, oneEther, ether('0.01'), accounts[2]]
      await foreignBridge.initializeInterest(...args, { from: user }).should.be.rejected
      await foreignBridge.initializeInterest(...args, { from: owner }).should.be.fulfilled

      expect(await dai.balanceOf(foreignBridge.address)).to.be.bignumber.equal(ether('10'))
      expect(await cDai.balanceOf(foreignBridge.address)).to.be.bignumber.equal(ZERO)
      expect(await foreignBridge.isInterestEnabled(dai.address)).to.be.equal(true)
      expect(await foreignBridge.minCashThreshold(dai.address)).to.be.bignumber.equal(oneEther)
      expect(await foreignBridge.minInterestPaid(dai.address)).to.be.bignumber.equal(ether('0.01'))
    })

    it('should enable and earn interest', async () => {
      const initialBalance = await dai.balanceOf(accounts[2])
      await foreignBridge.initializeInterest(dai.address, oneEther, ether('0.01'), accounts[2])

      expect(await foreignBridge.interestAmount(dai.address)).to.be.bignumber.equal(ZERO)
      await foreignBridge.invest(dai.address).should.be.fulfilled

      expect(await dai.balanceOf(foreignBridge.address)).to.be.bignumber.equal(ether('1'))
      expect(await dai.balanceOf(accounts[2])).to.be.bignumber.equal(initialBalance)
      expect(await cDai.balanceOf(foreignBridge.address)).to.be.bignumber.gt(ZERO)
      expect(await foreignBridge.interestAmount(dai.address)).to.be.bignumber.equal(ZERO)

      await generateInterest()

      expect(await foreignBridge.interestAmount(dai.address)).to.be.bignumber.gt(ZERO)
    })

    it('should pay interest', async () => {
      const initialBalance = await dai.balanceOf(accounts[2])
      await foreignBridge.initializeInterest(dai.address, oneEther, ether('0.01'), accounts[2])
      await foreignBridge.invest(dai.address).should.be.fulfilled
      await generateInterest()

      expect(await foreignBridge.interestAmount(dai.address)).to.be.bignumber.gt(ether('0.01'))

      await foreignBridge.payInterest(dai.address).should.be.fulfilled

      expect(await dai.balanceOf(foreignBridge.address)).to.be.bignumber.equal(ether('1'))
      expect(await dai.balanceOf(accounts[2])).to.be.bignumber.gt(initialBalance)
      expect(await cDai.balanceOf(foreignBridge.address)).to.be.bignumber.gt(ZERO)
      expect(await foreignBridge.interestAmount(dai.address)).to.be.bignumber.lt(ether('0.01'))
    })

    it('should disable interest', async () => {
      await foreignBridge.initializeInterest(dai.address, oneEther, ether('0.01'), accounts[2])
      await foreignBridge.invest(dai.address).should.be.fulfilled
      await generateInterest()
      await foreignBridge.payInterest(dai.address).should.be.fulfilled

      expect(await dai.balanceOf(foreignBridge.address)).to.be.bignumber.equal(ether('1'))

      await foreignBridge.disableInterest(dai.address, { from: user }).should.be.rejected
      await foreignBridge.disableInterest(dai.address, { from: owner }).should.be.fulfilled

      expect(await dai.balanceOf(foreignBridge.address)).to.be.bignumber.equal(ether('10'))
      expect(await cDai.balanceOf(foreignBridge.address)).to.be.bignumber.gt(ZERO)
    })

    it('configuration', async () => {
      await foreignBridge.initializeInterest(dai.address, oneEther, ether('0.01'), accounts[2])

      await foreignBridge.setMinCashThreshold(dai.address, ether('2'), { from: user }).should.be.rejected
      await foreignBridge.setMinCashThreshold(dai.address, ether('2'), { from: owner }).should.be.fulfilled
      expect(await foreignBridge.minCashThreshold(dai.address)).to.be.bignumber.equal(ether('2'))

      await foreignBridge.setMinInterestPaid(dai.address, oneEther, { from: user }).should.be.rejected
      await foreignBridge.setMinInterestPaid(dai.address, oneEther, { from: owner }).should.be.fulfilled
      expect(await foreignBridge.minInterestPaid(dai.address)).to.be.bignumber.equal(oneEther)

      await foreignBridge.setInterestReceiver(dai.address, accounts[1], { from: user }).should.be.rejected
      await foreignBridge.setInterestReceiver(dai.address, accounts[1], { from: owner }).should.be.fulfilled
      expect(await foreignBridge.interestReceiver(dai.address)).to.be.equal(accounts[1])
    })

    it('should claim comp', async () => {
      await foreignBridge.initializeInterest(dai.address, oneEther, ether('0.01'), accounts[2])
      await foreignBridge.setMinInterestPaid(comp.address, 1)
      await foreignBridge.setInterestReceiver(comp.address, accounts[2])
      await foreignBridge.invest(dai.address)
      await generateInterest()

      const initialBalance = await comp.balanceOf(accounts[2])
      await foreignBridge.claimCompAndPay()
      expect(await comp.balanceOf(accounts[2])).to.be.bignumber.gt(initialBalance)
    })
  })
})
