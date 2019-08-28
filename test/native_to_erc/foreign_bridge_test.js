const ForeignBridge = artifacts.require('ForeignBridgeNativeToErc.sol')
const ForeignBridgeV2 = artifacts.require('ForeignBridgeV2.sol')
const BridgeValidators = artifacts.require('BridgeValidators.sol')
const EternalStorageProxy = artifacts.require('EternalStorageProxy.sol')
const FeeManagerNativeToErc = artifacts.require('FeeManagerNativeToErc.sol')
const RewardableValidators = artifacts.require('RewardableValidators.sol')
const POA20 = artifacts.require('ERC677BridgeToken.sol')
const NoReturnTransferTokenMock = artifacts.require('NoReturnTransferTokenMock.sol')

const { expect } = require('chai')
const { ERROR_MSG, ZERO_ADDRESS, toBN } = require('../setup')
const { createMessage, sign, signatureToVRS, getEvents, ether, expectEventInLogs } = require('../helpers/helpers')

const oneEther = ether('1')
const halfEther = ether('0.5')
const minPerTx = ether('0.01')
const requireBlockConfirmations = 8
const gasPrice = web3.utils.toWei('1', 'gwei')
const homeDailyLimit = oneEther
const homeMaxPerTx = halfEther
const ZERO = toBN(0)
const decimalShiftZero = 0

contract('ForeignBridge', async accounts => {
  let validatorContract
  let authorities
  let owner
  let token
  before(async () => {
    validatorContract = await BridgeValidators.new()
    authorities = [accounts[1], accounts[2]]
    owner = accounts[0]
    await validatorContract.initialize(1, authorities, owner)
  })

  describe('#initialize', async () => {
    it('should initialize', async () => {
      token = await POA20.new('POA ERC20 Foundation', 'POA20', 18)
      const foreignBridge = await ForeignBridge.new()

      expect(await foreignBridge.validatorContract()).to.be.equal(ZERO_ADDRESS)
      expect(await foreignBridge.deployedAtBlock()).to.be.bignumber.equal(ZERO)
      expect(await foreignBridge.isInitialized()).to.be.equal(false)
      expect(await foreignBridge.requiredBlockConfirmations()).to.be.bignumber.equal(ZERO)
      expect(await foreignBridge.dailyLimit()).to.be.bignumber.equal(ZERO)
      expect(await foreignBridge.maxPerTx()).to.be.bignumber.equal(ZERO)
      expect(await foreignBridge.decimalShift()).to.be.bignumber.equal(ZERO)

      await foreignBridge
        .initialize(
          ZERO_ADDRESS,
          token.address,
          [oneEther, halfEther, minPerTx],
          gasPrice,
          requireBlockConfirmations,
          [homeDailyLimit, homeMaxPerTx],
          owner,
          decimalShiftZero
        )
        .should.be.rejectedWith(ERROR_MSG)
      await foreignBridge
        .initialize(
          validatorContract.address,
          ZERO_ADDRESS,
          [oneEther, halfEther, minPerTx],
          gasPrice,
          requireBlockConfirmations,
          [homeDailyLimit, homeMaxPerTx],
          owner,
          decimalShiftZero
        )
        .should.be.rejectedWith(ERROR_MSG)
      await foreignBridge
        .initialize(
          validatorContract.address,
          token.address,
          [oneEther, halfEther, minPerTx],
          0,
          requireBlockConfirmations,
          [homeDailyLimit, homeMaxPerTx],
          owner,
          decimalShiftZero
        )
        .should.be.rejectedWith(ERROR_MSG)
      await foreignBridge
        .initialize(
          owner,
          token.address,
          [oneEther, halfEther, minPerTx],
          requireBlockConfirmations,
          gasPrice,
          [homeDailyLimit, homeMaxPerTx],
          owner,
          decimalShiftZero
        )
        .should.be.rejectedWith(ERROR_MSG)
      await foreignBridge
        .initialize(
          validatorContract.address,
          owner,
          [oneEther, halfEther, minPerTx],
          requireBlockConfirmations,
          gasPrice,
          [homeDailyLimit, homeMaxPerTx],
          owner,
          decimalShiftZero
        )
        .should.be.rejectedWith(ERROR_MSG)
      await foreignBridge
        .initialize(
          validatorContract.address,
          token.address,
          [oneEther, halfEther, minPerTx],
          gasPrice,
          0,
          [homeDailyLimit, homeMaxPerTx],
          owner,
          decimalShiftZero
        )
        .should.be.rejectedWith(ERROR_MSG)
      const { logs } = await foreignBridge.initialize(
        validatorContract.address,
        token.address,
        [oneEther, halfEther, minPerTx],
        gasPrice,
        requireBlockConfirmations,
        [homeDailyLimit, homeMaxPerTx],
        owner,
        '9'
      )

      expect(await foreignBridge.isInitialized()).to.be.equal(true)
      expect(await foreignBridge.validatorContract()).to.be.equal(validatorContract.address)
      expect(await foreignBridge.deployedAtBlock()).to.be.bignumber.above(ZERO)
      expect(await foreignBridge.requiredBlockConfirmations()).to.be.bignumber.equal(
        requireBlockConfirmations.toString()
      )
      expect(await foreignBridge.gasPrice()).to.be.bignumber.equal(gasPrice)
      expect(await foreignBridge.dailyLimit()).to.be.bignumber.equal(oneEther)
      expect(await foreignBridge.maxPerTx()).to.be.bignumber.equal(halfEther)
      expect(await foreignBridge.minPerTx()).to.be.bignumber.equal(minPerTx)
      expect(await foreignBridge.decimalShift()).to.be.bignumber.equal('9')
      const bridgeMode = '0x92a8d7fe' // 4 bytes of keccak256('native-to-erc-core')
      expect(await foreignBridge.getBridgeMode()).to.be.equal(bridgeMode)
      const { major, minor, patch } = await foreignBridge.getBridgeInterfacesVersion()
      expect(major).to.be.bignumber.gte(ZERO)
      expect(minor).to.be.bignumber.gte(ZERO)
      expect(patch).to.be.bignumber.gte(ZERO)

      expectEventInLogs(logs, 'RequiredBlockConfirmationChanged', {
        requiredBlockConfirmations: toBN(requireBlockConfirmations)
      })
      expectEventInLogs(logs, 'GasPriceChanged', { gasPrice })
      expectEventInLogs(logs, 'ExecutionDailyLimitChanged', { newLimit: homeDailyLimit })
      expectEventInLogs(logs, 'DailyLimitChanged', { newLimit: oneEther })
    })
  })

  describe('#executeSignatures', async () => {
    let foreignBridge
    beforeEach(async () => {
      foreignBridge = await ForeignBridge.new()
      token = await POA20.new('POA ERC20 Foundation', 'POA20', 18)
      await foreignBridge.initialize(
        validatorContract.address,
        token.address,
        [oneEther, halfEther, minPerTx],
        gasPrice,
        requireBlockConfirmations,
        [homeDailyLimit, homeMaxPerTx],
        owner,
        decimalShiftZero
      )
      await token.transferOwnership(foreignBridge.address)
    })
    it('should allow to deposit', async () => {
      const recipientAccount = accounts[3]
      const balanceBefore = await token.balanceOf(recipientAccount)
      const totalSupplyBefore = await token.totalSupply()
      const value = ether('0.25')
      const transactionHash = '0x1045bfe274b88120a6b1e5d01b5ec00ab5d01098346e90e7c7a3c9b8f0181c80'
      const message = createMessage(recipientAccount, value, transactionHash, foreignBridge.address)
      const signature = await sign(authorities[0], message)
      const vrs = signatureToVRS(signature)
      false.should.be.equal(await foreignBridge.relayedMessages(transactionHash))
      const { logs } = await foreignBridge.executeSignatures([vrs.v], [vrs.r], [vrs.s], message).should.be.fulfilled
      logs[0].event.should.be.equal('RelayedMessage')
      logs[0].args.recipient.should.be.equal(recipientAccount)
      logs[0].args.value.should.be.bignumber.equal(value)
      logs[0].args.transactionHash.should.be.equal(transactionHash)

      const balanceAfter = await token.balanceOf(recipientAccount)
      const totalSupplyAfter = await token.totalSupply()
      balanceAfter.should.be.bignumber.equal(balanceBefore.add(value))
      totalSupplyAfter.should.be.bignumber.equal(totalSupplyBefore.add(value))
      true.should.be.equal(await foreignBridge.relayedMessages(transactionHash))
    })
    it('should reject if address is not foreign address', async () => {
      const recipientAccount = accounts[3]
      const value = ether('0.25')
      const transactionHash = '0x1045bfe274b88120a6b1e5d01b5ec00ab5d01098346e90e7c7a3c9b8f0181c80'
      const message = createMessage(recipientAccount, value, transactionHash, accounts[0])
      const signature = await sign(authorities[0], message)
      const vrs = signatureToVRS(signature)
      false.should.be.equal(await foreignBridge.relayedMessages(transactionHash))
      await foreignBridge.executeSignatures([vrs.v], [vrs.r], [vrs.s], message).should.be.rejectedWith(ERROR_MSG)
    })
    it('should allow second deposit with different transactionHash but same recipient and value', async () => {
      const recipientAccount = accounts[3]
      const balanceBefore = await token.balanceOf(recipientAccount)
      // tx 1
      const value = ether('0.25')
      const transactionHash = '0x35d3818e50234655f6aebb2a1cfbf30f59568d8a4ec72066fac5a25dbe7b8121'
      const message = createMessage(recipientAccount, value, transactionHash, foreignBridge.address)
      const signature = await sign(authorities[0], message)
      const vrs = signatureToVRS(signature)
      false.should.be.equal(await foreignBridge.relayedMessages(transactionHash))
      await foreignBridge.executeSignatures([vrs.v], [vrs.r], [vrs.s], message).should.be.fulfilled
      // tx 2
      const transactionHash2 = '0x77a496628a776a03d58d7e6059a5937f04bebd8ba4ff89f76dd4bb8ba7e291ee'
      const message2 = createMessage(recipientAccount, value, transactionHash2, foreignBridge.address)
      const signature2 = await sign(authorities[0], message2)
      const vrs2 = signatureToVRS(signature2)
      false.should.be.equal(await foreignBridge.relayedMessages(transactionHash2))
      const { logs } = await foreignBridge.executeSignatures([vrs2.v], [vrs2.r], [vrs2.s], message2).should.be.fulfilled

      logs[0].event.should.be.equal('RelayedMessage')
      logs[0].args.recipient.should.be.equal(recipientAccount)
      logs[0].args.value.should.be.bignumber.equal(value)
      logs[0].args.transactionHash.should.be.equal(transactionHash2)
      const totalSupply = await token.totalSupply()
      const balanceAfter = await token.balanceOf(recipientAccount)
      balanceAfter.should.be.bignumber.equal(balanceBefore.add(value.mul(toBN(2))))
      totalSupply.should.be.bignumber.equal(value.mul(toBN(2)))
      true.should.be.equal(await foreignBridge.relayedMessages(transactionHash))
      true.should.be.equal(await foreignBridge.relayedMessages(transactionHash2))
    })

    it('should not allow second deposit (replay attack) with same transactionHash but different recipient', async () => {
      const recipientAccount = accounts[3]
      // tx 1
      const value = halfEther
      const transactionHash = '0x35d3818e50234655f6aebb2a1cfbf30f59568d8a4ec72066fac5a25dbe7b8121'
      const message = createMessage(recipientAccount, value, transactionHash, foreignBridge.address)
      const signature = await sign(authorities[0], message)
      const vrs = signatureToVRS(signature)
      false.should.be.equal(await foreignBridge.relayedMessages(transactionHash))
      await foreignBridge.executeSignatures([vrs.v], [vrs.r], [vrs.s], message).should.be.fulfilled
      // tx 2
      const message2 = createMessage(accounts[4], value, transactionHash, foreignBridge.address)
      const signature2 = await sign(authorities[0], message2)
      const vrs2 = signatureToVRS(signature2)
      true.should.be.equal(await foreignBridge.relayedMessages(transactionHash))
      await foreignBridge.executeSignatures([vrs2.v], [vrs2.r], [vrs2.s], message2).should.be.rejectedWith(ERROR_MSG)
    })

    it('should not allow withdraw over home max tx limit', async () => {
      const recipientAccount = accounts[3]
      const invalidValue = ether('0.75')

      const transactionHash = '0x35d3818e50234655f6aebb2a1cfbf30f59568d8a4ec72066fac5a25dbe7b8121'
      const message = createMessage(recipientAccount, invalidValue, transactionHash, foreignBridge.address)
      const signature = await sign(authorities[0], message)
      const vrs = signatureToVRS(signature)

      await foreignBridge.executeSignatures([vrs.v], [vrs.r], [vrs.s], message).should.be.rejectedWith(ERROR_MSG)
    })

    it('should not allow withdraw over daily home limit', async () => {
      const recipientAccount = accounts[3]

      const transactionHash = '0x35d3818e50234655f6aebb2a1cfbf30f59568d8a4ec72066fac5a25dbe7b8121'
      const message = createMessage(recipientAccount, halfEther, transactionHash, foreignBridge.address)
      const signature = await sign(authorities[0], message)
      const vrs = signatureToVRS(signature)

      await foreignBridge.executeSignatures([vrs.v], [vrs.r], [vrs.s], message).should.be.fulfilled

      const transactionHash2 = '0x69debd8fd1923c9cb3cd8ef6461e2740b2d037943b941729d5a47671a2bb8712'
      const message2 = createMessage(recipientAccount, halfEther, transactionHash2, foreignBridge.address)
      const signature2 = await sign(authorities[0], message2)
      const vrs2 = signatureToVRS(signature2)

      await foreignBridge.executeSignatures([vrs2.v], [vrs2.r], [vrs2.s], message2).should.be.fulfilled

      const transactionHash3 = '0x022695428093bb292db8e48bd1417c5e1b84c0bf673bd0fff23ed0fb6495b872'
      const message3 = createMessage(recipientAccount, halfEther, transactionHash3, foreignBridge.address)
      const signature3 = await sign(authorities[0], message3)
      const vrs3 = signatureToVRS(signature3)

      await foreignBridge.executeSignatures([vrs3.v], [vrs3.r], [vrs3.s], message3).should.be.rejectedWith(ERROR_MSG)
    })
  })

  describe('#executeSignatures with 2 minimum signatures', async () => {
    let multisigValidatorContract
    let twoAuthorities
    let ownerOfValidatorContract
    let foreignBridgeWithMultiSignatures
    beforeEach(async () => {
      multisigValidatorContract = await BridgeValidators.new()
      token = await POA20.new('POA ERC20 Foundation', 'POA20', 18)
      twoAuthorities = [accounts[0], accounts[1]]
      ownerOfValidatorContract = accounts[3]
      await multisigValidatorContract.initialize(2, twoAuthorities, ownerOfValidatorContract, {
        from: ownerOfValidatorContract
      })
      foreignBridgeWithMultiSignatures = await ForeignBridge.new()
      await foreignBridgeWithMultiSignatures.initialize(
        multisigValidatorContract.address,
        token.address,
        [oneEther, halfEther, minPerTx],
        gasPrice,
        requireBlockConfirmations,
        [homeDailyLimit, homeMaxPerTx],
        owner,
        decimalShiftZero,
        { from: ownerOfValidatorContract }
      )
      await token.transferOwnership(foreignBridgeWithMultiSignatures.address)
    })
    it('deposit should fail if not enough signatures are provided', async () => {
      const recipientAccount = accounts[4]
      // msg 1
      const value = halfEther
      const transactionHash = '0x35d3818e50234655f6aebb2a1cfbf30f59568d8a4ec72066fac5a25dbe7b8121'
      const message = createMessage(recipientAccount, value, transactionHash, foreignBridgeWithMultiSignatures.address)
      const signature = await sign(twoAuthorities[0], message)
      const vrs = signatureToVRS(signature)
      false.should.be.equal(await foreignBridgeWithMultiSignatures.relayedMessages(transactionHash))
      await foreignBridgeWithMultiSignatures
        .executeSignatures([vrs.v], [vrs.r], [vrs.s], message)
        .should.be.rejectedWith(ERROR_MSG)
      // msg 2
      const signature2 = await sign(twoAuthorities[1], message)
      const vrs2 = signatureToVRS(signature2)
      const { logs } = await foreignBridgeWithMultiSignatures.executeSignatures(
        [vrs.v, vrs2.v],
        [vrs.r, vrs2.r],
        [vrs.s, vrs2.s],
        message
      ).should.be.fulfilled

      logs[0].event.should.be.equal('RelayedMessage')
      logs[0].args.recipient.should.be.equal(recipientAccount)
      logs[0].args.value.should.be.bignumber.equal(value)
      logs[0].args.transactionHash.should.be.equal(transactionHash)
      true.should.be.equal(await foreignBridgeWithMultiSignatures.relayedMessages(transactionHash))
    })
    it('deposit should fail if duplicate signature is provided', async () => {
      const recipientAccount = accounts[4]
      // msg 1
      const value = halfEther
      const transactionHash = '0x35d3818e50234655f6aebb2a1cfbf30f59568d8a4ec72066fac5a25dbe7b8121'
      const message = createMessage(recipientAccount, value, transactionHash, foreignBridgeWithMultiSignatures.address)
      const signature = await sign(twoAuthorities[0], message)
      const vrs = signatureToVRS(signature)
      false.should.be.equal(await foreignBridgeWithMultiSignatures.relayedMessages(transactionHash))
      await foreignBridgeWithMultiSignatures
        .executeSignatures([vrs.v, vrs.v], [vrs.r, vrs.r], [vrs.s, vrs.s], message)
        .should.be.rejectedWith(ERROR_MSG)
    })
    it('works with 5 validators and 3 required signatures', async () => {
      const recipient = accounts[8]
      const authoritiesFiveAccs = [accounts[1], accounts[2], accounts[3], accounts[4], accounts[5]]
      const ownerOfValidators = accounts[0]
      const validatorContractWith3Signatures = await BridgeValidators.new()
      await validatorContractWith3Signatures.initialize(3, authoritiesFiveAccs, ownerOfValidators)
      const erc20Token = await POA20.new('Some ERC20', 'RSZT', 18)
      const value = halfEther
      const foreignBridgeWithThreeSigs = await ForeignBridge.new()

      await foreignBridgeWithThreeSigs.initialize(
        validatorContractWith3Signatures.address,
        erc20Token.address,
        [oneEther, halfEther, minPerTx],
        gasPrice,
        requireBlockConfirmations,
        [homeDailyLimit, homeMaxPerTx],
        owner,
        decimalShiftZero
      )
      await erc20Token.transferOwnership(foreignBridgeWithThreeSigs.address)

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

      const { logs } = await foreignBridgeWithThreeSigs.executeSignatures(
        [vrs.v, vrs2.v, vrs3.v],
        [vrs.r, vrs2.r, vrs3.r],
        [vrs.s, vrs2.s, vrs3.s],
        message
      ).should.be.fulfilled
      logs[0].event.should.be.equal('RelayedMessage')
      logs[0].args.recipient.should.be.equal(recipient)
      logs[0].args.value.should.be.bignumber.equal(value)
      true.should.be.equal(await foreignBridgeWithThreeSigs.relayedMessages(txHash))
    })
    it('Should fail if length of signatures is not equal', async () => {
      const recipient = accounts[8]
      const authoritiesFiveAccs = [accounts[1], accounts[2], accounts[3], accounts[4], accounts[5]]
      const ownerOfValidators = accounts[0]
      const validatorContractWith3Signatures = await BridgeValidators.new()
      await validatorContractWith3Signatures.initialize(3, authoritiesFiveAccs, ownerOfValidators)
      const erc20Token = await POA20.new('Some ERC20', 'RSZT', 18)
      const value = halfEther
      const foreignBridgeWithThreeSigs = await ForeignBridge.new()

      await foreignBridgeWithThreeSigs.initialize(
        validatorContractWith3Signatures.address,
        erc20Token.address,
        [oneEther, halfEther, minPerTx],
        gasPrice,
        requireBlockConfirmations,
        [homeDailyLimit, homeMaxPerTx],
        owner,
        decimalShiftZero
      )
      await erc20Token.transferOwnership(foreignBridgeWithThreeSigs.address)

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
      await foreignBridgeWithThreeSigs
        .executeSignatures([vrs.v, vrs2.v], [vrs.r], [vrs.s, vrs2.s, vrs3.s], message)
        .should.be.rejectedWith(ERROR_MSG)
      const { logs } = await foreignBridgeWithThreeSigs.executeSignatures(
        [vrs.v, vrs2.v, vrs3.v],
        [vrs.r, vrs2.r, vrs3.r],
        [vrs.s, vrs2.s, vrs3.s],
        message
      ).should.be.fulfilled
      logs[0].event.should.be.equal('RelayedMessage')
      logs[0].args.recipient.should.be.equal(recipient)
      logs[0].args.value.should.be.bignumber.equal(value)
      true.should.be.equal(await foreignBridgeWithThreeSigs.relayedMessages(txHash))
    })
  })

  describe('#onTokenTransfer', async () => {
    it('can only be called from token contract', async () => {
      const owner = accounts[3]
      const user = accounts[4]
      token = await POA20.new('POA ERC20 Foundation', 'POA20', 18, { from: owner })
      const foreignBridge = await ForeignBridge.new()
      await foreignBridge.initialize(
        validatorContract.address,
        token.address,
        [oneEther, halfEther, minPerTx],
        gasPrice,
        requireBlockConfirmations,
        [homeDailyLimit, homeMaxPerTx],
        owner,
        decimalShiftZero
      )
      await token.mint(user, halfEther, { from: owner }).should.be.fulfilled
      await token.transferOwnership(foreignBridge.address, { from: owner })
      await foreignBridge.onTokenTransfer(user, halfEther, '0x00', { from: owner }).should.be.rejectedWith(ERROR_MSG)
      await token.transferAndCall(foreignBridge.address, halfEther, '0x00', { from: user }).should.be.fulfilled
      expect(await token.totalSupply()).to.be.bignumber.equal(ZERO)
      expect(await token.balanceOf(user)).to.be.bignumber.equal(ZERO)
    })
    it('should not allow to burn more than the limit', async () => {
      const owner = accounts[3]
      const user = accounts[4]
      const valueMoreThanLimit = halfEther.add(toBN(1))
      token = await POA20.new('POA ERC20 Foundation', 'POA20', 18, { from: owner })
      const foreignBridge = await ForeignBridge.new()

      await foreignBridge.initialize(
        validatorContract.address,
        token.address,
        [oneEther, halfEther, minPerTx],
        gasPrice,
        requireBlockConfirmations,
        [homeDailyLimit, homeMaxPerTx],
        owner,
        decimalShiftZero
      )
      await token.mint(user, valueMoreThanLimit, { from: owner }).should.be.fulfilled
      await token.transferOwnership(foreignBridge.address, { from: owner })

      await token
        .transferAndCall(foreignBridge.address, valueMoreThanLimit, '0x00', { from: user })
        .should.be.rejectedWith(ERROR_MSG)

      valueMoreThanLimit.should.be.bignumber.equal(await token.totalSupply())
      valueMoreThanLimit.should.be.bignumber.equal(await token.balanceOf(user))

      await token.transferAndCall(foreignBridge.address, halfEther, '0x00', { from: user }).should.be.fulfilled

      expect(await token.totalSupply()).to.be.bignumber.equal('1')
      expect(await token.balanceOf(user)).to.be.bignumber.equal('1')

      const events = await getEvents(foreignBridge, { event: 'UserRequestForAffirmation' })
      expect(events[0].returnValues.recipient).to.be.equal(user)
      expect(toBN(events[0].returnValues.value)).to.be.bignumber.equal(halfEther)
    })
    it('should only let to send within maxPerTx limit', async () => {
      const owner = accounts[3]
      const user = accounts[4]
      const valueMoreThanLimit = halfEther.add(toBN(1))
      token = await POA20.new('POA ERC20 Foundation', 'POA20', 18, { from: owner })
      const foreignBridge = await ForeignBridge.new()
      await foreignBridge.initialize(
        validatorContract.address,
        token.address,
        [oneEther, halfEther, minPerTx],
        gasPrice,
        requireBlockConfirmations,
        [homeDailyLimit, homeMaxPerTx],
        owner,
        decimalShiftZero
      )
      await token.mint(user, oneEther.add(toBN(1)), { from: owner }).should.be.fulfilled

      await token.transferOwnership(foreignBridge.address, { from: owner })

      await token
        .transferAndCall(foreignBridge.address, valueMoreThanLimit, '0x00', { from: user })
        .should.be.rejectedWith(ERROR_MSG)

      oneEther.add(toBN(1)).should.be.bignumber.equal(await token.totalSupply())
      oneEther.add(toBN(1)).should.be.bignumber.equal(await token.balanceOf(user))

      await token.transferAndCall(foreignBridge.address, halfEther, '0x00', { from: user }).should.be.fulfilled

      valueMoreThanLimit.should.be.bignumber.equal(await token.totalSupply())
      valueMoreThanLimit.should.be.bignumber.equal(await token.balanceOf(user))

      await token.transferAndCall(foreignBridge.address, halfEther, '0x00', { from: user }).should.be.fulfilled

      expect(await token.totalSupply()).to.be.bignumber.equal('1')
      expect(await token.balanceOf(user)).to.be.bignumber.equal('1')
      await token.transferAndCall(foreignBridge.address, '1', '0x00', { from: user }).should.be.rejectedWith(ERROR_MSG)
    })

    it('should not let to withdraw less than minPerTx', async () => {
      const owner = accounts[3]
      const user = accounts[4]
      const valueLessThanMinPerTx = minPerTx.sub(toBN(1))
      token = await POA20.new('POA ERC20 Foundation', 'POA20', 18, { from: owner })
      const foreignBridge = await ForeignBridge.new()
      await foreignBridge.initialize(
        validatorContract.address,
        token.address,
        [oneEther, halfEther, minPerTx],
        gasPrice,
        requireBlockConfirmations,
        [homeDailyLimit, homeMaxPerTx],
        owner,
        decimalShiftZero
      )
      await token.mint(user, oneEther, { from: owner }).should.be.fulfilled
      await token.transferOwnership(foreignBridge.address, { from: owner })

      await token
        .transferAndCall(foreignBridge.address, valueLessThanMinPerTx, '0x00', { from: user })
        .should.be.rejectedWith(ERROR_MSG)

      oneEther.should.be.bignumber.equal(await token.totalSupply())
      oneEther.should.be.bignumber.equal(await token.balanceOf(user))

      await token.transferAndCall(foreignBridge.address, minPerTx, '0x00', { from: user }).should.be.fulfilled

      oneEther.sub(minPerTx).should.be.bignumber.equal(await token.totalSupply())
      oneEther.sub(minPerTx).should.be.bignumber.equal(await token.balanceOf(user))
    })
  })

  describe('#setting limits', async () => {
    let foreignBridge
    beforeEach(async () => {
      token = await POA20.new('POA ERC20 Foundation', 'POA20', 18)
      foreignBridge = await ForeignBridge.new()
      await foreignBridge.initialize(
        validatorContract.address,
        token.address,
        [oneEther, halfEther, minPerTx],
        gasPrice,
        requireBlockConfirmations,
        [homeDailyLimit, homeMaxPerTx],
        owner,
        decimalShiftZero
      )
      await token.transferOwnership(foreignBridge.address)
    })
    it('#setMaxPerTx allows to set only to owner and cannot be more than daily limit', async () => {
      await foreignBridge.setMaxPerTx(halfEther, { from: authorities[0] }).should.be.rejectedWith(ERROR_MSG)
      await foreignBridge.setMaxPerTx(halfEther, { from: owner }).should.be.fulfilled

      await foreignBridge.setMaxPerTx(oneEther, { from: owner }).should.be.rejectedWith(ERROR_MSG)
    })

    it('#setMinPerTx allows to set only to owner and cannot be more than daily limit and should be less than maxPerTx', async () => {
      await foreignBridge.setMinPerTx(minPerTx, { from: authorities[0] }).should.be.rejectedWith(ERROR_MSG)
      await foreignBridge.setMinPerTx(minPerTx, { from: owner }).should.be.fulfilled

      await foreignBridge.setMinPerTx(oneEther, { from: owner }).should.be.rejectedWith(ERROR_MSG)
    })
  })

  describe('#upgradeable', async () => {
    it('can be upgraded', async () => {
      const REQUIRED_NUMBER_OF_VALIDATORS = 1
      const VALIDATORS = [accounts[1]]
      const PROXY_OWNER = accounts[0]
      const FOREIGN_DAILY_LIMIT = oneEther
      const FOREIGN_MAX_AMOUNT_PER_TX = halfEther
      const FOREIGN_MIN_AMOUNT_PER_TX = minPerTx
      // Validators Contract
      let validatorsProxy = await EternalStorageProxy.new().should.be.fulfilled
      const validatorsContractImpl = await BridgeValidators.new().should.be.fulfilled
      await validatorsProxy.upgradeTo('1', validatorsContractImpl.address).should.be.fulfilled
      validatorsContractImpl.address.should.be.equal(await validatorsProxy.implementation())

      validatorsProxy = await BridgeValidators.at(validatorsProxy.address)
      await validatorsProxy.initialize(REQUIRED_NUMBER_OF_VALIDATORS, VALIDATORS, PROXY_OWNER).should.be.fulfilled
      // POA20
      const token = await POA20.new('POA ERC20 Foundation', 'POA20', 18)

      // ForeignBridge V1 Contract

      let foreignBridgeProxy = await EternalStorageProxy.new().should.be.fulfilled
      const foreignBridgeImpl = await ForeignBridge.new().should.be.fulfilled
      await foreignBridgeProxy.upgradeTo('1', foreignBridgeImpl.address).should.be.fulfilled

      foreignBridgeProxy = await ForeignBridge.at(foreignBridgeProxy.address)
      await foreignBridgeProxy.initialize(
        validatorsProxy.address,
        token.address,
        [FOREIGN_DAILY_LIMIT, FOREIGN_MAX_AMOUNT_PER_TX, FOREIGN_MIN_AMOUNT_PER_TX],
        gasPrice,
        requireBlockConfirmations,
        [homeDailyLimit, homeMaxPerTx],
        owner,
        decimalShiftZero
      )
      await token.transferOwnership(foreignBridgeProxy.address).should.be.fulfilled

      foreignBridgeProxy.address.should.be.equal(await token.owner())

      // Deploy V2
      const foreignImplV2 = await ForeignBridgeV2.new()
      const foreignBridgeProxyUpgrade = await EternalStorageProxy.at(foreignBridgeProxy.address)
      await foreignBridgeProxyUpgrade.upgradeTo('2', foreignImplV2.address).should.be.fulfilled
      foreignImplV2.address.should.be.equal(await foreignBridgeProxyUpgrade.implementation())
    })
    it('can be deployed via upgradeToAndCall', async () => {
      const tokenAddress = token.address
      const validatorsAddress = validatorContract.address
      const FOREIGN_DAILY_LIMIT = '3'
      const FOREIGN_MAX_AMOUNT_PER_TX = '2'
      const FOREIGN_MIN_AMOUNT_PER_TX = '1'

      const storageProxy = await EternalStorageProxy.new().should.be.fulfilled
      const foreignBridge = await ForeignBridge.new()
      const data = foreignBridge.contract.methods
        .initialize(
          validatorsAddress,
          tokenAddress,
          [FOREIGN_DAILY_LIMIT, FOREIGN_MAX_AMOUNT_PER_TX, FOREIGN_MIN_AMOUNT_PER_TX],
          gasPrice,
          requireBlockConfirmations,
          ['3', '2'],
          owner,
          decimalShiftZero
        )
        .encodeABI()
      await storageProxy.upgradeToAndCall('1', foreignBridge.address, data).should.be.fulfilled
      const finalContract = await ForeignBridge.at(storageProxy.address)
      true.should.be.equal(await finalContract.isInitialized())
      validatorsAddress.should.be.equal(await finalContract.validatorContract())

      expect(await finalContract.dailyLimit()).to.be.bignumber.equal(FOREIGN_DAILY_LIMIT)
      expect(await finalContract.maxPerTx()).to.be.bignumber.equal(FOREIGN_MAX_AMOUNT_PER_TX)
      expect(await finalContract.minPerTx()).to.be.bignumber.equal(FOREIGN_MIN_AMOUNT_PER_TX)
    })
    it('can transfer ownership', async () => {
      const token = await POA20.new('POA ERC20 Foundation', 'POA20', 18)
      const foreignBridge = await ForeignBridge.new()
      const storageProxy = await EternalStorageProxy.new().should.be.fulfilled
      const data = foreignBridge.contract.methods
        .initialize(
          validatorContract.address,
          token.address,
          ['3', '2', '1'],
          gasPrice,
          requireBlockConfirmations,
          ['3', '2'],
          owner,
          decimalShiftZero
        )
        .encodeABI()
      await storageProxy.upgradeToAndCall('1', foreignBridge.address, data).should.be.fulfilled
      await storageProxy.transferProxyOwnership(owner).should.be.fulfilled
    })
  })

  describe('#claimTokens', async () => {
    it('can send erc20', async () => {
      const owner = accounts[0]
      token = await POA20.new('POA ERC20 Foundation', 'POA20', 18)
      const foreignBridgeImpl = await ForeignBridge.new()
      const storageProxy = await EternalStorageProxy.new().should.be.fulfilled
      await storageProxy.upgradeTo('1', foreignBridgeImpl.address).should.be.fulfilled
      const foreignBridge = await ForeignBridge.at(storageProxy.address)
      await foreignBridge.initialize(
        validatorContract.address,
        token.address,
        [oneEther, halfEther, minPerTx],
        gasPrice,
        requireBlockConfirmations,
        [homeDailyLimit, homeMaxPerTx],
        owner,
        decimalShiftZero
      )
      await token.transferOwnership(foreignBridge.address)

      const tokenSecond = await POA20.new('Roman Token', 'RST', 18)

      await tokenSecond.mint(accounts[0], halfEther).should.be.fulfilled
      expect(await tokenSecond.balanceOf(accounts[0])).to.be.bignumber.equal(halfEther)

      await tokenSecond.transfer(foreignBridge.address, halfEther)
      expect(await tokenSecond.balanceOf(accounts[0])).to.be.bignumber.equal(ZERO)
      expect(await tokenSecond.balanceOf(foreignBridge.address)).to.be.bignumber.equal(halfEther)

      await foreignBridge.claimTokens(tokenSecond.address, accounts[3], { from: owner })
      expect(await tokenSecond.balanceOf(foreignBridge.address)).to.be.bignumber.equal(ZERO)
      expect(await tokenSecond.balanceOf(accounts[3])).to.be.bignumber.equal(halfEther)
    })
    it('also calls claimTokens on tokenAddress', async () => {
      const owner = accounts[0]
      token = await POA20.new('POA ERC20 Foundation', 'POA20', 18)
      const foreignBridgeImpl = await ForeignBridge.new()
      const storageProxy = await EternalStorageProxy.new().should.be.fulfilled
      await storageProxy.upgradeTo('1', foreignBridgeImpl.address).should.be.fulfilled
      const foreignBridge = await ForeignBridge.at(storageProxy.address)
      await foreignBridge.initialize(
        validatorContract.address,
        token.address,
        [oneEther, halfEther, minPerTx],
        gasPrice,
        requireBlockConfirmations,
        [homeDailyLimit, homeMaxPerTx],
        owner,
        decimalShiftZero
      )
      await token.transferOwnership(foreignBridge.address)

      const tokenSecond = await POA20.new('Roman Token', 'RST', 18)

      await tokenSecond.mint(accounts[0], 150).should.be.fulfilled
      expect(await tokenSecond.balanceOf(accounts[0])).to.be.bignumber.equal('150')

      await tokenSecond.transfer(token.address, '150')
      expect(await tokenSecond.balanceOf(accounts[0])).to.be.bignumber.equal(ZERO)
      expect(await tokenSecond.balanceOf(token.address)).to.be.bignumber.equal('150')

      await foreignBridge.claimTokensFromErc677(tokenSecond.address, accounts[3], { from: owner })
      expect(await tokenSecond.balanceOf(token.address)).to.be.bignumber.equal(ZERO)
      expect(await tokenSecond.balanceOf(accounts[3])).to.be.bignumber.equal('150')
    })
    it('works with token that not return on transfer', async () => {
      const owner = accounts[0]
      token = await POA20.new('POA ERC20 Foundation', 'POA20', 18)
      const foreignBridgeImpl = await ForeignBridge.new()
      const storageProxy = await EternalStorageProxy.new().should.be.fulfilled
      await storageProxy.upgradeTo('1', foreignBridgeImpl.address).should.be.fulfilled
      const foreignBridge = await ForeignBridge.at(storageProxy.address)
      await foreignBridge.initialize(
        validatorContract.address,
        token.address,
        [oneEther, halfEther, minPerTx],
        gasPrice,
        requireBlockConfirmations,
        [homeDailyLimit, homeMaxPerTx],
        owner,
        decimalShiftZero
      )

      const tokenMock = await NoReturnTransferTokenMock.new()

      await tokenMock.mint(accounts[0], halfEther).should.be.fulfilled
      expect(await tokenMock.balanceOf(accounts[0])).to.be.bignumber.equal(halfEther)

      await tokenMock.transfer(foreignBridge.address, halfEther).should.be.fulfilled
      expect(await tokenMock.balanceOf(accounts[0])).to.be.bignumber.equal(ZERO)
      expect(await tokenMock.balanceOf(foreignBridge.address)).to.be.bignumber.equal(halfEther)

      await foreignBridge.claimTokens(tokenMock.address, accounts[3], { from: owner }).should.be.fulfilled
      expect(await tokenMock.balanceOf(foreignBridge.address)).to.be.bignumber.equal(ZERO)
      expect(await tokenMock.balanceOf(accounts[3])).to.be.bignumber.equal(halfEther)
    })
  })

  describe('#rewardableInitialize', async () => {
    let homeFee
    let foreignBridge
    let token
    let rewardableValidators
    const validators = [accounts[1]]
    const rewards = [accounts[2]]
    const requiredSignatures = 1
    beforeEach(async () => {
      token = await POA20.new('POA ERC20 Foundation', 'POA20', 18)
      rewardableValidators = await RewardableValidators.new()
      await rewardableValidators.initialize(requiredSignatures, validators, rewards, owner).should.be.fulfilled
      foreignBridge = await ForeignBridge.new()
      homeFee = ether('0.001')
    })
    it('sets variables', async () => {
      const feeManager = await FeeManagerNativeToErc.new()
      expect(await foreignBridge.validatorContract()).to.be.equal(ZERO_ADDRESS)
      expect(await foreignBridge.deployedAtBlock()).to.be.bignumber.equal(ZERO)
      expect(await foreignBridge.isInitialized()).to.be.equal(false)
      expect(await foreignBridge.requiredBlockConfirmations()).to.be.bignumber.equal(ZERO)
      expect(await foreignBridge.dailyLimit()).to.be.bignumber.equal(ZERO)
      expect(await foreignBridge.maxPerTx()).to.be.bignumber.equal(ZERO)
      expect(await foreignBridge.decimalShift()).to.be.bignumber.equal(ZERO)

      await foreignBridge
        .rewardableInitialize(
          ZERO_ADDRESS,
          token.address,
          [oneEther, halfEther, minPerTx],
          gasPrice,
          requireBlockConfirmations,
          [homeDailyLimit, homeMaxPerTx],
          owner,
          feeManager.address,
          homeFee,
          decimalShiftZero
        )
        .should.be.rejectedWith(ERROR_MSG)
      await foreignBridge
        .rewardableInitialize(
          rewardableValidators.address,
          ZERO_ADDRESS,
          [oneEther, halfEther, minPerTx],
          gasPrice,
          requireBlockConfirmations,
          [homeDailyLimit, homeMaxPerTx],
          owner,
          feeManager.address,
          homeFee,
          decimalShiftZero
        )
        .should.be.rejectedWith(ERROR_MSG)
      await foreignBridge
        .rewardableInitialize(
          rewardableValidators.address,
          token.address,
          [oneEther, halfEther, minPerTx],
          0,
          requireBlockConfirmations,
          [homeDailyLimit, homeMaxPerTx],
          owner,
          feeManager.address,
          homeFee,
          decimalShiftZero
        )
        .should.be.rejectedWith(ERROR_MSG)
      await foreignBridge
        .rewardableInitialize(
          owner,
          token.address,
          [oneEther, halfEther, minPerTx],
          requireBlockConfirmations,
          gasPrice,
          [homeDailyLimit, homeMaxPerTx],
          owner,
          feeManager.address,
          homeFee,
          decimalShiftZero
        )
        .should.be.rejectedWith(ERROR_MSG)
      await foreignBridge
        .rewardableInitialize(
          rewardableValidators.address,
          owner,
          [oneEther, halfEther, minPerTx],
          requireBlockConfirmations,
          gasPrice,
          [homeDailyLimit, homeMaxPerTx],
          owner,
          feeManager.address,
          homeFee,
          decimalShiftZero
        )
        .should.be.rejectedWith(ERROR_MSG)
      await foreignBridge
        .rewardableInitialize(
          rewardableValidators.address,
          owner,
          [oneEther, halfEther, minPerTx],
          requireBlockConfirmations,
          gasPrice,
          [homeDailyLimit, homeMaxPerTx],
          owner,
          ZERO_ADDRESS,
          homeFee,
          decimalShiftZero
        )
        .should.be.rejectedWith(ERROR_MSG)
      await foreignBridge.rewardableInitialize(
        rewardableValidators.address,
        token.address,
        [oneEther, halfEther, minPerTx],
        gasPrice,
        requireBlockConfirmations,
        [homeDailyLimit, homeMaxPerTx],
        owner,
        feeManager.address,
        homeFee,
        '9'
      ).should.be.fulfilled

      expect(await foreignBridge.isInitialized()).to.be.equal(true)
      expect(await foreignBridge.validatorContract()).to.be.equal(rewardableValidators.address)
      expect(await foreignBridge.deployedAtBlock()).to.be.bignumber.above(ZERO)
      expect(await foreignBridge.requiredBlockConfirmations()).to.be.bignumber.equal(
        requireBlockConfirmations.toString()
      )
      expect(await foreignBridge.gasPrice()).to.be.bignumber.equal(gasPrice)
      expect(await foreignBridge.dailyLimit()).to.be.bignumber.equal(oneEther)
      expect(await foreignBridge.maxPerTx()).to.be.bignumber.equal(halfEther)
      expect(await foreignBridge.minPerTx()).to.be.bignumber.equal(minPerTx)
      expect(await foreignBridge.decimalShift()).to.be.bignumber.equal('9')
      const bridgeMode = '0x92a8d7fe' // 4 bytes of keccak256('native-to-erc-core')
      expect(await foreignBridge.getBridgeMode()).to.be.equal(bridgeMode)
      const { major, minor, patch } = await foreignBridge.getBridgeInterfacesVersion()
      expect(major).to.be.bignumber.gte(ZERO)
      expect(minor).to.be.bignumber.gte(ZERO)
      expect(patch).to.be.bignumber.gte(ZERO)

      expect(await foreignBridge.feeManagerContract()).to.be.equals(feeManager.address)
      expect(await foreignBridge.getHomeFee()).to.be.bignumber.equals(homeFee)
    })

    it('can update fee contract', async () => {
      const feeManager = await FeeManagerNativeToErc.new()
      await foreignBridge.rewardableInitialize(
        rewardableValidators.address,
        token.address,
        [oneEther, halfEther, minPerTx],
        gasPrice,
        requireBlockConfirmations,
        [homeDailyLimit, homeMaxPerTx],
        owner,
        feeManager.address,
        homeFee,
        decimalShiftZero
      ).should.be.fulfilled

      // Given
      const newFeeManager = await FeeManagerNativeToErc.new()

      // When
      await foreignBridge.setFeeManagerContract(newFeeManager.address, { from: owner }).should.be.fulfilled

      // Then
      expect(await foreignBridge.feeManagerContract()).to.be.equals(newFeeManager.address)
    })

    it('can update fee', async () => {
      const feeManager = await FeeManagerNativeToErc.new()
      await foreignBridge.rewardableInitialize(
        rewardableValidators.address,
        token.address,
        [oneEther, halfEther, minPerTx],
        gasPrice,
        requireBlockConfirmations,
        [homeDailyLimit, homeMaxPerTx],
        owner,
        feeManager.address,
        homeFee,
        decimalShiftZero
      ).should.be.fulfilled

      // Given
      const newHomeFee = ether('0.1')

      // When
      await foreignBridge.setHomeFee(newHomeFee, { from: owner }).should.be.fulfilled

      // Then
      expect(await foreignBridge.getHomeFee()).to.be.bignumber.equals(newHomeFee)
    })
    it('fee should be less than 100%', async () => {
      const feeManager = await FeeManagerNativeToErc.new()
      await foreignBridge.rewardableInitialize(
        rewardableValidators.address,
        token.address,
        [oneEther, halfEther, minPerTx],
        gasPrice,
        requireBlockConfirmations,
        [homeDailyLimit, homeMaxPerTx],
        owner,
        feeManager.address,
        homeFee,
        decimalShiftZero
      ).should.be.fulfilled

      // Given
      const invalidFee = ether('1')
      const invalidBigFee = ether('2')
      const newHomeFee = ether('0.99')

      // When
      await foreignBridge.setHomeFee(invalidFee, { from: owner }).should.be.rejectedWith(ERROR_MSG)
      await foreignBridge.setHomeFee(invalidBigFee, { from: owner }).should.be.rejectedWith(ERROR_MSG)
      await foreignBridge.setHomeFee(newHomeFee, { from: owner }).should.be.fulfilled

      // Then
      expect(await foreignBridge.getHomeFee()).to.be.bignumber.equals(newHomeFee)
    })

    it('should be able to get fee manager mode', async () => {
      // Given
      const feeManager = await FeeManagerNativeToErc.new()
      const oneDirectionsModeHash = '0xf2aed8f7'

      // When
      await foreignBridge.rewardableInitialize(
        rewardableValidators.address,
        token.address,
        [oneEther, halfEther, minPerTx],
        gasPrice,
        requireBlockConfirmations,
        [homeDailyLimit, homeMaxPerTx],
        owner,
        feeManager.address,
        homeFee,
        decimalShiftZero
      ).should.be.fulfilled

      // Then
      expect(await foreignBridge.getFeeManagerMode()).to.be.equals(oneDirectionsModeHash)
    })
  })

  describe('#RewardableBridge_executeSignatures', async () => {
    let feeManager
    let foreignBridge
    let token
    let rewardableValidators
    beforeEach(async () => {
      feeManager = await FeeManagerNativeToErc.new()
      token = await POA20.new('POA ERC20 Foundation', 'POA20', 18)
      rewardableValidators = await RewardableValidators.new()
      foreignBridge = await ForeignBridge.new()
    })
    it('should distribute fee to validator', async () => {
      const fee = 0.001
      const feeInWei = ether(fee.toString())
      const value = halfEther
      const valueCalc = 0.5 * (1 - fee)
      const feeAmountCalc = 0.5 * fee
      const finalUserValue = ether(valueCalc.toString())
      const feeAmount = ether(feeAmountCalc.toString())

      const validators = [accounts[1]]
      const rewards = [accounts[2]]
      const requiredSignatures = 1
      await rewardableValidators.initialize(requiredSignatures, validators, rewards, owner).should.be.fulfilled
      await foreignBridge.rewardableInitialize(
        rewardableValidators.address,
        token.address,
        [oneEther, halfEther, minPerTx],
        gasPrice,
        requireBlockConfirmations,
        [homeDailyLimit, homeMaxPerTx],
        owner,
        feeManager.address,
        feeInWei,
        decimalShiftZero
      ).should.be.fulfilled
      await token.transferOwnership(foreignBridge.address)

      const recipientAccount = accounts[3]
      const balanceBefore = await token.balanceOf(recipientAccount)
      const initialBalanceRewardAddress = await token.balanceOf(rewards[0])
      const totalSupplyBefore = await token.totalSupply()
      const transactionHash = '0x1045bfe274b88120a6b1e5d01b5ec00ab5d01098346e90e7c7a3c9b8f0181c80'
      const message = createMessage(recipientAccount, value, transactionHash, foreignBridge.address)
      const signature = await sign(validators[0], message)
      const vrs = signatureToVRS(signature)

      const { logs } = await foreignBridge.executeSignatures([vrs.v], [vrs.r], [vrs.s], message).should.be.fulfilled

      logs[0].event.should.be.equal('FeeDistributedFromSignatures')
      logs[0].args.feeAmount.should.be.bignumber.equal(feeAmount)
      logs[0].args.transactionHash.should.be.equal(transactionHash)

      logs[1].event.should.be.equal('RelayedMessage')
      logs[1].args.recipient.should.be.equal(recipientAccount)
      logs[1].args.value.should.be.bignumber.equal(value)
      logs[1].args.transactionHash.should.be.equal(transactionHash)

      const balanceAfter = await token.balanceOf(recipientAccount)
      const totalSupplyAfter = await token.totalSupply()
      balanceAfter.should.be.bignumber.equal(balanceBefore.add(finalUserValue))
      totalSupplyAfter.should.be.bignumber.equal(totalSupplyBefore.add(value))

      const updatedBalanceRewardAddress = await token.balanceOf(rewards[0])
      updatedBalanceRewardAddress.should.be.bignumber.equal(initialBalanceRewardAddress.add(feeAmount))
    })
    it('should distribute fee to 3 validators', async () => {
      // Given
      const fee = 0.001
      const feeInWei = ether(fee.toString())
      const feePerValidator = toBN(166666666666666)
      const feePerValidatorPlusDiff = toBN(166666666666668)
      const value = halfEther
      const valueCalc = 0.5 * (1 - fee)
      const feeAmountCalc = 0.5 * fee
      const finalUserValue = ether(valueCalc.toString())
      const feeAmount = ether(feeAmountCalc.toString())

      const validators = [accounts[1], accounts[2], accounts[3]]
      const rewards = [accounts[4], accounts[5], accounts[6]]
      const requiredSignatures = 3
      await rewardableValidators.initialize(requiredSignatures, validators, rewards, owner).should.be.fulfilled
      await foreignBridge.rewardableInitialize(
        rewardableValidators.address,
        token.address,
        [oneEther, halfEther, minPerTx],
        gasPrice,
        requireBlockConfirmations,
        [homeDailyLimit, homeMaxPerTx],
        owner,
        feeManager.address,
        feeInWei,
        decimalShiftZero
      ).should.be.fulfilled
      await token.transferOwnership(foreignBridge.address)

      const recipientAccount = accounts[7]
      const balanceBefore = await token.balanceOf(recipientAccount)
      const totalSupplyBefore = await token.totalSupply()

      const initialBalanceRewardAddress1 = await token.balanceOf(rewards[0])
      const initialBalanceRewardAddress2 = await token.balanceOf(rewards[1])
      const initialBalanceRewardAddress3 = await token.balanceOf(rewards[2])

      const transactionHash = '0x1045bfe274b88120a6b1e5d01b5ec00ab5d01098346e90e7c7a3c9b8f0181c80'
      const message = createMessage(recipientAccount, value, transactionHash, foreignBridge.address)
      const signature1 = await sign(validators[0], message)
      const signature2 = await sign(validators[1], message)
      const signature3 = await sign(validators[2], message)
      const vrs = signatureToVRS(signature1)
      const vrs2 = signatureToVRS(signature2)
      const vrs3 = signatureToVRS(signature3)

      // When
      const { logs } = await foreignBridge.executeSignatures(
        [vrs.v, vrs2.v, vrs3.v],
        [vrs.r, vrs2.r, vrs3.r],
        [vrs.s, vrs2.s, vrs3.s],
        message
      ).should.be.fulfilled

      // Then
      logs[0].event.should.be.equal('FeeDistributedFromSignatures')
      logs[0].args.feeAmount.should.be.bignumber.equal(feeAmount)
      logs[0].args.transactionHash.should.be.equal(transactionHash)

      logs[1].event.should.be.equal('RelayedMessage')
      logs[1].args.recipient.should.be.equal(recipientAccount)
      logs[1].args.value.should.be.bignumber.equal(value)
      logs[1].args.transactionHash.should.be.equal(transactionHash)

      const balanceAfter = await token.balanceOf(recipientAccount)
      const totalSupplyAfter = await token.totalSupply()
      balanceAfter.should.be.bignumber.equal(balanceBefore.add(finalUserValue))
      totalSupplyAfter.should.be.bignumber.equal(totalSupplyBefore.add(value))

      const updatedBalanceRewardAddress1 = await token.balanceOf(rewards[0])
      const updatedBalanceRewardAddress2 = await token.balanceOf(rewards[1])
      const updatedBalanceRewardAddress3 = await token.balanceOf(rewards[2])

      expect(
        updatedBalanceRewardAddress1.eq(initialBalanceRewardAddress1.add(feePerValidator)) ||
          updatedBalanceRewardAddress1.eq(initialBalanceRewardAddress1.add(feePerValidatorPlusDiff))
      ).to.equal(true)
      expect(
        updatedBalanceRewardAddress2.eq(initialBalanceRewardAddress2.add(feePerValidator)) ||
          updatedBalanceRewardAddress2.eq(initialBalanceRewardAddress2.add(feePerValidatorPlusDiff))
      ).to.equal(true)
      expect(
        updatedBalanceRewardAddress3.eq(initialBalanceRewardAddress3.add(feePerValidator)) ||
          updatedBalanceRewardAddress3.eq(initialBalanceRewardAddress3.add(feePerValidatorPlusDiff))
      ).to.equal(true)
    })
    it('should distribute fee to 5 validators', async () => {
      // Given
      const fee = 0.001
      const feeInWei = ether(fee.toString())
      const value = halfEther
      const valueCalc = 0.5 * (1 - fee)
      const feeAmountCalc = 0.5 * fee
      const finalUserValue = ether(valueCalc.toString())
      const feeAmount = ether(feeAmountCalc.toString())
      const feePerValidator = feeAmount.div(toBN(5))

      const validators = [accounts[0], accounts[1], accounts[2], accounts[3], accounts[4]]
      const rewards = [accounts[5], accounts[6], accounts[7], accounts[8], accounts[9]]
      const requiredSignatures = 3
      await rewardableValidators.initialize(requiredSignatures, validators, rewards, owner).should.be.fulfilled
      await foreignBridge.rewardableInitialize(
        rewardableValidators.address,
        token.address,
        [oneEther, halfEther, minPerTx],
        gasPrice,
        requireBlockConfirmations,
        [homeDailyLimit, homeMaxPerTx],
        owner,
        feeManager.address,
        feeInWei,
        decimalShiftZero
      ).should.be.fulfilled
      await token.transferOwnership(foreignBridge.address)

      const recipientAccount = accounts[0]
      const balanceBefore = await token.balanceOf(recipientAccount)
      const totalSupplyBefore = await token.totalSupply()

      const initialBalanceRewardAddress1 = await token.balanceOf(rewards[0])
      const initialBalanceRewardAddress2 = await token.balanceOf(rewards[1])
      const initialBalanceRewardAddress3 = await token.balanceOf(rewards[2])
      const initialBalanceRewardAddress4 = await token.balanceOf(rewards[3])
      const initialBalanceRewardAddress5 = await token.balanceOf(rewards[4])

      const transactionHash = '0x1045bfe274b88120a6b1e5d01b5ec00ab5d01098346e90e7c7a3c9b8f0181c80'
      const message = createMessage(recipientAccount, value, transactionHash, foreignBridge.address)
      const signature1 = await sign(validators[0], message)
      const signature2 = await sign(validators[1], message)
      const signature3 = await sign(validators[2], message)
      const vrs = signatureToVRS(signature1)
      const vrs2 = signatureToVRS(signature2)
      const vrs3 = signatureToVRS(signature3)

      // When
      const { logs } = await foreignBridge.executeSignatures(
        [vrs.v, vrs2.v, vrs3.v],
        [vrs.r, vrs2.r, vrs3.r],
        [vrs.s, vrs2.s, vrs3.s],
        message
      ).should.be.fulfilled

      // Then
      logs[0].event.should.be.equal('FeeDistributedFromSignatures')
      logs[0].args.feeAmount.should.be.bignumber.equal(feeAmount)
      logs[0].args.transactionHash.should.be.equal(transactionHash)

      logs[1].event.should.be.equal('RelayedMessage')
      logs[1].args.recipient.should.be.equal(recipientAccount)
      logs[1].args.value.should.be.bignumber.equal(value)
      logs[1].args.transactionHash.should.be.equal(transactionHash)

      const balanceAfter = await token.balanceOf(recipientAccount)
      const totalSupplyAfter = await token.totalSupply()
      balanceAfter.should.be.bignumber.equal(balanceBefore.add(finalUserValue))
      totalSupplyAfter.should.be.bignumber.equal(totalSupplyBefore.add(value))

      const updatedBalanceRewardAddress1 = await token.balanceOf(rewards[0])
      const updatedBalanceRewardAddress2 = await token.balanceOf(rewards[1])
      const updatedBalanceRewardAddress3 = await token.balanceOf(rewards[2])
      const updatedBalanceRewardAddress4 = await token.balanceOf(rewards[3])
      const updatedBalanceRewardAddress5 = await token.balanceOf(rewards[4])

      updatedBalanceRewardAddress1.should.be.bignumber.equal(initialBalanceRewardAddress1.add(feePerValidator))
      updatedBalanceRewardAddress2.should.be.bignumber.equal(initialBalanceRewardAddress2.add(feePerValidator))
      updatedBalanceRewardAddress3.should.be.bignumber.equal(initialBalanceRewardAddress3.add(feePerValidator))
      updatedBalanceRewardAddress4.should.be.bignumber.equal(initialBalanceRewardAddress4.add(feePerValidator))
      updatedBalanceRewardAddress5.should.be.bignumber.equal(initialBalanceRewardAddress5.add(feePerValidator))
    })
  })
  describe('#decimalShift', async () => {
    const decimalShiftTwo = 2
    it('Home to Foreign: withdraw works with decimalShift of 2', async () => {
      const recipient = accounts[8]
      const authoritiesFiveAccs = [accounts[1], accounts[2], accounts[3], accounts[4], accounts[5]]
      const ownerOfValidators = accounts[0]
      const validatorContractWith3Signatures = await BridgeValidators.new()
      await validatorContractWith3Signatures.initialize(3, authoritiesFiveAccs, ownerOfValidators)
      const erc20Token = await POA20.new('Some ERC20', 'RSZT', 16)
      const valueOnForeign = toBN('1000')
      const valueOnHome = toBN(valueOnForeign * 10 ** decimalShiftTwo)
      const foreignBridgeWithThreeSigs = await ForeignBridge.new()

      await foreignBridgeWithThreeSigs.initialize(
        validatorContractWith3Signatures.address,
        erc20Token.address,
        [oneEther, halfEther, minPerTx],
        gasPrice,
        requireBlockConfirmations,
        [homeDailyLimit, homeMaxPerTx],
        owner,
        decimalShiftTwo
      )
      await erc20Token.transferOwnership(foreignBridgeWithThreeSigs.address)

      const balanceBeforeRecipient = await erc20Token.balanceOf(recipient)
      const txHash = '0x35d3818e50234655f6aebb2a1cfbf30f59568d8a4ec72066fac5a25dbe7b8121'
      const message = createMessage(recipient, valueOnHome, txHash, foreignBridgeWithThreeSigs.address)

      // signature 1
      const signature = await sign(authoritiesFiveAccs[0], message)
      const vrs = signatureToVRS(signature)

      // signature 2
      const signature2 = await sign(authoritiesFiveAccs[1], message)
      const vrs2 = signatureToVRS(signature2)

      // signature 3
      const signature3 = await sign(authoritiesFiveAccs[2], message)
      const vrs3 = signatureToVRS(signature3)

      const { logs } = await foreignBridgeWithThreeSigs.executeSignatures(
        [vrs.v, vrs2.v, vrs3.v],
        [vrs.r, vrs2.r, vrs3.r],
        [vrs.s, vrs2.s, vrs3.s],
        message
      ).should.be.fulfilled
      logs[0].event.should.be.equal('RelayedMessage')
      logs[0].args.recipient.should.be.equal(recipient)
      logs[0].args.value.should.be.bignumber.equal(valueOnHome)
      true.should.be.equal(await foreignBridgeWithThreeSigs.relayedMessages(txHash))
      const balanceAfterRecipient = await erc20Token.balanceOf(recipient)
      balanceAfterRecipient.should.be.bignumber.equal(balanceBeforeRecipient.add(valueOnForeign))
      const balanceAfterBridge = await erc20Token.balanceOf(foreignBridgeWithThreeSigs.address)
      balanceAfterBridge.should.be.bignumber.equal(ZERO)
    })
    it('Foreign to Home: no impact in transferAndCall event signal for bridges oracles with a decimalShift of 2.', async () => {
      const owner = accounts[3]
      const user = accounts[4]
      const value = halfEther
      token = await POA20.new('POA ERC20 Foundation', 'POA20', 16, { from: owner })
      const foreignBridge = await ForeignBridge.new()
      await foreignBridge.initialize(
        validatorContract.address,
        token.address,
        [oneEther, halfEther, minPerTx],
        gasPrice,
        requireBlockConfirmations,
        [homeDailyLimit, homeMaxPerTx],
        owner,
        decimalShiftTwo
      )
      await token.mint(user, value, { from: owner }).should.be.fulfilled
      expect(await token.balanceOf(user)).to.be.bignumber.equal(value)
      await token.transferOwnership(foreignBridge.address, { from: owner })
      const { logs } = await token.transferAndCall(foreignBridge.address, value, '0x00', { from: user })
      logs[0].event.should.be.equal('Transfer')
      logs[0].args.value.should.be.bignumber.equal(value)
      expect(await token.balanceOf(user)).to.be.bignumber.equal(ZERO)
    })
  })
})
