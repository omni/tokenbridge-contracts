const HomeBridge = artifacts.require('HomeBridgeErcToErc.sol')
const POSDAOHomeBridge = artifacts.require('HomeBridgeErcToErcPOSDAO.sol')
const EternalStorageProxy = artifacts.require('EternalStorageProxy.sol')
const BridgeValidators = artifacts.require('BridgeValidators.sol')
const ERC677BridgeToken = artifacts.require('ERC677BridgeToken.sol')
const ERC677BridgeTokenRewardable = artifacts.require('ERC677BridgeTokenRewardable.sol')
const FeeManagerErcToErcPOSDAO = artifacts.require('FeeManagerErcToErcPOSDAO.sol')
const RewardableValidators = artifacts.require('RewardableValidators.sol')
const BlockReward = artifacts.require('BlockRewardMock.sol')
const OldBlockReward = artifacts.require('OldBlockReward')

const { expect } = require('chai')
const { ERROR_MSG, ZERO_ADDRESS, toBN } = require('../setup')
const { createMessage, sign, getEvents, ether, expectEventInLogs, createAccounts } = require('../helpers/helpers')

const minPerTx = ether('0.01')
const requireBlockConfirmations = 8
const gasPrice = web3.utils.toWei('1', 'gwei')
const quarterEther = ether('0.25')
const oneEther = ether('1')
const halfEther = ether('0.5')
const foreignDailyLimit = oneEther
const foreignMaxPerTx = halfEther
const ZERO = toBN(0)
const MAX_GAS = 8000000
const MAX_VALIDATORS = 50
const decimalShiftZero = 0
const markedAsProcessed = toBN(2)
  .pow(toBN(255))
  .add(toBN(1))

contract('HomeBridge_ERC20_to_ERC20', async accounts => {
  let homeContract
  let validatorContract
  let authorities
  let owner
  let token
  before(async () => {
    validatorContract = await BridgeValidators.new()
    authorities = [accounts[1]]
    owner = accounts[0]
    await validatorContract.initialize(1, authorities, owner)
  })
  describe('#initialize', async () => {
    beforeEach(async () => {
      homeContract = await HomeBridge.new()
      token = await ERC677BridgeToken.new('Some ERC20', 'RSZT', 18)
    })
    it('sets variables', async () => {
      expect(await homeContract.validatorContract()).to.be.equal(ZERO_ADDRESS)
      expect(await homeContract.deployedAtBlock()).to.be.bignumber.equal(ZERO)
      expect(await homeContract.dailyLimit()).to.be.bignumber.equal(ZERO)
      expect(await homeContract.maxPerTx()).to.be.bignumber.equal(ZERO)
      expect(await homeContract.decimalShift()).to.be.bignumber.equal(ZERO)
      expect(await homeContract.isInitialized()).to.be.equal(false)

      const { logs } = await homeContract.initialize(
        validatorContract.address,
        ['3', '2', '1'],
        gasPrice,
        requireBlockConfirmations,
        token.address,
        [foreignDailyLimit, foreignMaxPerTx],
        owner,
        '9'
      ).should.be.fulfilled

      expect(await homeContract.isInitialized()).to.be.equal(true)
      expect(await homeContract.validatorContract()).to.be.equal(validatorContract.address)
      expect(await homeContract.deployedAtBlock()).to.be.bignumber.above(ZERO)
      expect(await homeContract.dailyLimit()).to.be.bignumber.equal('3')
      expect(await homeContract.maxPerTx()).to.be.bignumber.equal('2')
      expect(await homeContract.minPerTx()).to.be.bignumber.equal('1')
      expect(await homeContract.decimalShift()).to.be.bignumber.equal('9')
      const bridgeMode = '0xba4690f5' // 4 bytes of keccak256('erc-to-erc-core')
      expect(await homeContract.getBridgeMode()).to.be.equal(bridgeMode)
      const { major, minor, patch } = await homeContract.getBridgeInterfacesVersion()
      expect(major).to.be.bignumber.gte(ZERO)
      expect(minor).to.be.bignumber.gte(ZERO)
      expect(patch).to.be.bignumber.gte(ZERO)

      expectEventInLogs(logs, 'RequiredBlockConfirmationChanged', {
        requiredBlockConfirmations: toBN(requireBlockConfirmations)
      })
      expectEventInLogs(logs, 'GasPriceChanged', { gasPrice })
      expectEventInLogs(logs, 'DailyLimitChanged', { newLimit: '3' })
      expectEventInLogs(logs, 'ExecutionDailyLimitChanged', { newLimit: foreignDailyLimit })
    })
    it('cant set maxPerTx > dailyLimit', async () => {
      expect(await homeContract.isInitialized()).to.be.equal(false)

      await homeContract
        .initialize(
          validatorContract.address,
          ['1', '2', '1'],
          gasPrice,
          requireBlockConfirmations,
          token.address,
          [foreignDailyLimit, foreignMaxPerTx],
          owner,
          decimalShiftZero
        )
        .should.be.rejectedWith(ERROR_MSG)
      await homeContract
        .initialize(
          validatorContract.address,
          ['3', '2', '2'],
          gasPrice,
          requireBlockConfirmations,
          token.address,
          [foreignDailyLimit, foreignMaxPerTx],
          owner,
          decimalShiftZero
        )
        .should.be.rejectedWith(ERROR_MSG)

      expect(await homeContract.isInitialized()).to.be.equal(false)
    })

    it('can be deployed via upgradeToAndCall', async () => {
      const storageProxy = await EternalStorageProxy.new().should.be.fulfilled
      const data = homeContract.contract.methods
        .initialize(
          validatorContract.address,
          ['3', '2', '1'],
          gasPrice,
          requireBlockConfirmations,
          token.address,
          ['3', '2'],
          owner,
          decimalShiftZero
        )
        .encodeABI()
      await storageProxy.upgradeToAndCall('1', homeContract.address, data).should.be.fulfilled
      const finalContract = await HomeBridge.at(storageProxy.address)

      expect(await finalContract.isInitialized()).to.be.equal(true)
      expect(await finalContract.validatorContract()).to.be.equal(validatorContract.address)
      expect(await finalContract.dailyLimit()).to.be.bignumber.equal('3')
      expect(await finalContract.maxPerTx()).to.be.bignumber.equal('2')
      expect(await finalContract.minPerTx()).to.be.bignumber.equal('1')
    })

    it('cant initialize with invalid arguments', async () => {
      expect(await homeContract.isInitialized()).to.be.equal(false)

      await homeContract
        .initialize(
          validatorContract.address,
          ['3', '2', '1'],
          gasPrice,
          0,
          token.address,
          [foreignDailyLimit, foreignMaxPerTx],
          owner,
          decimalShiftZero
        )
        .should.be.rejectedWith(ERROR_MSG)
      await homeContract
        .initialize(
          owner,
          ['3', '2', '1'],
          gasPrice,
          requireBlockConfirmations,
          token.address,
          [foreignDailyLimit, foreignMaxPerTx],
          owner,
          decimalShiftZero
        )
        .should.be.rejectedWith(ERROR_MSG)
      await homeContract
        .initialize(
          ZERO_ADDRESS,
          ['3', '2', '1'],
          gasPrice,
          requireBlockConfirmations,
          token.address,
          [foreignDailyLimit, foreignMaxPerTx],
          owner,
          decimalShiftZero
        )
        .should.be.rejectedWith(ERROR_MSG)
      await homeContract
        .initialize(
          validatorContract.address,
          ['3', '2', '1'],
          gasPrice,
          requireBlockConfirmations,
          ZERO_ADDRESS,
          [foreignDailyLimit, foreignMaxPerTx],
          owner,
          decimalShiftZero
        )
        .should.be.rejectedWith(ERROR_MSG)
      await homeContract
        .initialize(
          validatorContract.address,
          ['3', '2', '1'],
          gasPrice,
          requireBlockConfirmations,
          owner,
          [foreignDailyLimit, foreignMaxPerTx],
          owner,
          decimalShiftZero
        )
        .should.be.rejectedWith(ERROR_MSG)
      await homeContract
        .initialize(
          validatorContract.address,
          ['3', '2', '1'],
          gasPrice,
          requireBlockConfirmations,
          token.address,
          [halfEther, oneEther],
          owner,
          decimalShiftZero
        )
        .should.be.rejectedWith(ERROR_MSG)

      // not valid decimal shift
      await homeContract.initialize(
        validatorContract.address,
        ['3', '2', '1'],
        gasPrice,
        requireBlockConfirmations,
        token.address,
        [foreignDailyLimit, foreignMaxPerTx],
        owner,
        100
      ).should.be.rejected

      await homeContract.initialize(
        validatorContract.address,
        ['3', '2', '1'],
        gasPrice,
        requireBlockConfirmations,
        token.address,
        [foreignDailyLimit, foreignMaxPerTx],
        owner,
        decimalShiftZero
      ).should.be.fulfilled

      expect(await homeContract.isInitialized()).to.be.equal(true)
    })
    it('can initialize with zero gas price ', async () => {
      // Given
      expect(await homeContract.isInitialized()).to.be.equal(false)

      // When
      await homeContract.initialize(
        validatorContract.address,
        ['3', '2', '1'],
        0,
        requireBlockConfirmations,
        token.address,
        [foreignDailyLimit, foreignMaxPerTx],
        owner,
        decimalShiftZero
      ).should.be.fulfilled

      // Then
      expect(await homeContract.isInitialized()).to.be.equal(true)
    })
  })

  describe('#fallback', async () => {
    beforeEach(async () => {
      homeContract = await HomeBridge.new()
      token = await ERC677BridgeToken.new('Some ERC20', 'RSZT', 18)
      await homeContract.initialize(
        validatorContract.address,
        ['3', '2', '1'],
        gasPrice,
        requireBlockConfirmations,
        token.address,
        [foreignDailyLimit, foreignMaxPerTx],
        owner,
        decimalShiftZero
      )
    })
    it('reverts', async () => {
      await homeContract
        .sendTransaction({
          from: accounts[1],
          value: 1
        })
        .should.be.rejectedWith(ERROR_MSG)
    })
  })

  describe('#setting limits', async () => {
    let homeContract
    beforeEach(async () => {
      homeContract = await HomeBridge.new()
      token = await ERC677BridgeToken.new('Some ERC20', 'RSZT', 18)
      await homeContract.initialize(
        validatorContract.address,
        ['3', '2', '1'],
        gasPrice,
        requireBlockConfirmations,
        token.address,
        [foreignDailyLimit, foreignMaxPerTx],
        owner,
        decimalShiftZero
      )
    })
    it('#setMaxPerTx allows to set only to owner and cannot be more than daily limit', async () => {
      await homeContract.setMaxPerTx(2, { from: authorities[0] }).should.be.rejectedWith(ERROR_MSG)
      await homeContract.setMaxPerTx(2, { from: owner }).should.be.fulfilled

      await homeContract.setMaxPerTx(3, { from: owner }).should.be.rejectedWith(ERROR_MSG)
    })

    it('#setMinPerTx allows to set only to owner and cannot be more than daily limit and should be less than maxPerTx', async () => {
      await homeContract.setMinPerTx(1, { from: authorities[0] }).should.be.rejectedWith(ERROR_MSG)
      await homeContract.setMinPerTx(1, { from: owner }).should.be.fulfilled

      await homeContract.setMinPerTx(2, { from: owner }).should.be.rejectedWith(ERROR_MSG)
    })
  })

  describe('#executeAffirmation', async () => {
    let homeBridge
    beforeEach(async () => {
      homeBridge = await HomeBridge.new()
      token = await ERC677BridgeToken.new('Some ERC20', 'RSZT', 18)
      await homeBridge.initialize(
        validatorContract.address,
        [oneEther, halfEther, minPerTx],
        gasPrice,
        requireBlockConfirmations,
        token.address,
        [foreignDailyLimit, foreignMaxPerTx],
        owner,
        decimalShiftZero
      )
      await token.transferOwnership(homeBridge.address)
    })
    it('should allow validator to withdraw', async () => {
      const recipient = accounts[5]
      const value = halfEther
      const balanceBefore = await token.balanceOf(recipient)
      const transactionHash = '0x806335163828a8eda675cff9c84fa6e6c7cf06bb44cc6ec832e42fe789d01415'
      const { logs } = await homeBridge.executeAffirmation(recipient, value, transactionHash, {
        from: authorities[0]
      })
      expectEventInLogs(logs, 'SignedForAffirmation', {
        signer: authorities[0],
        transactionHash
      })
      expectEventInLogs(logs, 'AffirmationCompleted', {
        recipient,
        value,
        transactionHash
      })

      const totalSupply = await token.totalSupply()
      const balanceAfter = await token.balanceOf(recipient)
      balanceAfter.should.be.bignumber.equal(balanceBefore.add(value))
      totalSupply.should.be.bignumber.equal(value)

      const msgHash = web3.utils.soliditySha3(recipient, value, transactionHash)
      const senderHash = web3.utils.soliditySha3(authorities[0], msgHash)
      true.should.be.equal(await homeBridge.affirmationsSigned(senderHash))
      markedAsProcessed.should.be.bignumber.equal(await homeBridge.numAffirmationsSigned(msgHash))
      await homeBridge
        .executeAffirmation(recipient, value, transactionHash, { from: authorities[0] })
        .should.be.rejectedWith(ERROR_MSG)
    })

    it('should allow validator to withdraw with zero value', async () => {
      const recipient = accounts[5]
      const value = ZERO
      const balanceBefore = await token.balanceOf(recipient)
      const transactionHash = '0x806335163828a8eda675cff9c84fa6e6c7cf06bb44cc6ec832e42fe789d01415'

      const { logs } = await homeBridge.executeAffirmation(recipient, value, transactionHash, {
        from: authorities[0]
      })

      expectEventInLogs(logs, 'SignedForAffirmation', {
        signer: authorities[0],
        transactionHash
      })
      expectEventInLogs(logs, 'AffirmationCompleted', {
        recipient,
        value,
        transactionHash
      })

      const totalSupply = await token.totalSupply()
      const balanceAfter = await token.balanceOf(recipient)
      balanceAfter.should.be.bignumber.equal(balanceBefore.add(value))
      totalSupply.should.be.bignumber.equal(value)

      const msgHash = web3.utils.soliditySha3(recipient, value, transactionHash)
      const senderHash = web3.utils.soliditySha3(authorities[0], msgHash)
      true.should.be.equal(await homeBridge.affirmationsSigned(senderHash))
      markedAsProcessed.should.be.bignumber.equal(await homeBridge.numAffirmationsSigned(msgHash))
      await homeBridge
        .executeAffirmation(recipient, value, transactionHash, { from: authorities[0] })
        .should.be.rejectedWith(ERROR_MSG)
    })

    it('test with 2 signatures required', async () => {
      const token2sig = await ERC677BridgeToken.new('Some ERC20', 'RSZT', 18)
      const validatorContractWith2Signatures = await BridgeValidators.new()
      const authoritiesThreeAccs = [accounts[1], accounts[2], accounts[3]]
      const ownerOfValidators = accounts[0]
      await validatorContractWith2Signatures.initialize(2, authoritiesThreeAccs, ownerOfValidators)
      const homeBridgeWithTwoSigs = await HomeBridge.new()
      await homeBridgeWithTwoSigs.initialize(
        validatorContractWith2Signatures.address,
        [oneEther, halfEther, minPerTx],
        gasPrice,
        requireBlockConfirmations,
        token2sig.address,
        [foreignDailyLimit, foreignMaxPerTx],
        owner,
        decimalShiftZero
      )
      await token2sig.transferOwnership(homeBridgeWithTwoSigs.address)
      const recipient = accounts[5]
      const value = halfEther
      const transactionHash = '0x806335163828a8eda675cff9c84fa6e6c7cf06bb44cc6ec832e42fe789d01415'
      const balanceBefore = await token2sig.balanceOf(recipient)
      const msgHash = web3.utils.soliditySha3(recipient, value, transactionHash)

      const { logs } = await homeBridgeWithTwoSigs.executeAffirmation(recipient, value, transactionHash, {
        from: authoritiesThreeAccs[0]
      }).should.be.fulfilled

      expectEventInLogs(logs, 'SignedForAffirmation', {
        signer: authorities[0],
        transactionHash
      })

      expect(await token2sig.totalSupply()).to.be.bignumber.equal(ZERO)
      const notProcessed = await homeBridgeWithTwoSigs.numAffirmationsSigned(msgHash)
      notProcessed.should.be.bignumber.equal('1')

      await homeBridgeWithTwoSigs
        .executeAffirmation(recipient, value, transactionHash, { from: authoritiesThreeAccs[0] })
        .should.be.rejectedWith(ERROR_MSG)
      const secondSignature = await homeBridgeWithTwoSigs.executeAffirmation(recipient, value, transactionHash, {
        from: authoritiesThreeAccs[1]
      }).should.be.fulfilled

      const balanceAfter = await token2sig.balanceOf(recipient)
      balanceAfter.should.be.bignumber.equal(balanceBefore.add(value))

      expectEventInLogs(secondSignature.logs, 'AffirmationCompleted', {
        recipient,
        value,
        transactionHash
      })

      const senderHash = web3.utils.soliditySha3(authoritiesThreeAccs[0], msgHash)
      true.should.be.equal(await homeBridgeWithTwoSigs.affirmationsSigned(senderHash))

      const senderHash2 = web3.utils.soliditySha3(authoritiesThreeAccs[1], msgHash)
      true.should.be.equal(await homeBridgeWithTwoSigs.affirmationsSigned(senderHash2))

      const processed = toBN(2)
        .pow(toBN(255))
        .add(toBN(2))
      expect(await homeBridgeWithTwoSigs.numAffirmationsSigned(msgHash)).to.be.bignumber.equal(processed)
    })
    it('should not allow to double submit', async () => {
      const recipient = accounts[5]
      const value = '1'
      const transactionHash = '0x806335163828a8eda675cff9c84fa6e6c7cf06bb44cc6ec832e42fe789d01415'
      await homeBridge.executeAffirmation(recipient, value, transactionHash, {
        from: authorities[0]
      }).should.be.fulfilled
      await homeBridge
        .executeAffirmation(recipient, value, transactionHash, { from: authorities[0] })
        .should.be.rejectedWith(ERROR_MSG)
    })

    it('should not allow non-authorities to execute deposit', async () => {
      const recipient = accounts[5]
      const value = oneEther
      const transactionHash = '0x806335163828a8eda675cff9c84fa6e6c7cf06bb44cc6ec832e42fe789d01415'
      await homeBridge
        .executeAffirmation(recipient, value, transactionHash, { from: accounts[7] })
        .should.be.rejectedWith(ERROR_MSG)
    })

    it('doesnt allow to deposit if requiredSignatures has changed', async () => {
      const token2sig = await ERC677BridgeToken.new('Some ERC20', 'RSZT', 18)
      const validatorContractWith2Signatures = await BridgeValidators.new()
      const authoritiesThreeAccs = [accounts[1], accounts[2], accounts[3]]
      const ownerOfValidators = accounts[0]
      await validatorContractWith2Signatures.initialize(2, authoritiesThreeAccs, ownerOfValidators)
      const homeBridgeWithTwoSigs = await HomeBridge.new()
      await homeBridgeWithTwoSigs.initialize(
        validatorContractWith2Signatures.address,
        [oneEther, halfEther, minPerTx],
        gasPrice,
        requireBlockConfirmations,
        token2sig.address,
        [foreignDailyLimit, foreignMaxPerTx],
        owner,
        decimalShiftZero
      )
      await token2sig.transferOwnership(homeBridgeWithTwoSigs.address)
      const recipient = accounts[5]
      const value = halfEther.div(toBN(2))
      const transactionHash = '0x806335163828a8eda675cff9c84fa6e6c7cf06bb44cc6ec832e42fe789d01415'
      const balanceBefore = await token.balanceOf(recipient)

      await homeBridgeWithTwoSigs.executeAffirmation(recipient, value, transactionHash, {
        from: authoritiesThreeAccs[0]
      }).should.be.fulfilled
      await homeBridgeWithTwoSigs.executeAffirmation(recipient, value, transactionHash, {
        from: authoritiesThreeAccs[1]
      }).should.be.fulfilled
      balanceBefore.add(value).should.be.bignumber.equal(await token2sig.balanceOf(recipient))
      await validatorContractWith2Signatures.setRequiredSignatures(3).should.be.fulfilled
      await homeBridgeWithTwoSigs
        .executeAffirmation(recipient, value, transactionHash, { from: authoritiesThreeAccs[2] })
        .should.be.rejectedWith(ERROR_MSG)
      await validatorContractWith2Signatures.setRequiredSignatures(1).should.be.fulfilled
      await homeBridgeWithTwoSigs
        .executeAffirmation(recipient, value, transactionHash, { from: authoritiesThreeAccs[2] })
        .should.be.rejectedWith(ERROR_MSG)
      balanceBefore.add(value).should.be.bignumber.equal(await token2sig.balanceOf(recipient))
    })
    it('works with 5 validators and 3 required signatures', async () => {
      const recipient = accounts[8]
      const authoritiesFiveAccs = [accounts[1], accounts[2], accounts[3], accounts[4], accounts[5]]
      const ownerOfValidators = accounts[0]
      const validatorContractWith3Signatures = await BridgeValidators.new()
      await validatorContractWith3Signatures.initialize(3, authoritiesFiveAccs, ownerOfValidators)
      const token = await ERC677BridgeToken.new('Some ERC20', 'RSZT', 18)

      const homeBridgeWithThreeSigs = await HomeBridge.new()
      await homeBridgeWithThreeSigs.initialize(
        validatorContractWith3Signatures.address,
        [oneEther, halfEther, minPerTx],
        gasPrice,
        requireBlockConfirmations,
        token.address,
        [foreignDailyLimit, foreignMaxPerTx],
        owner,
        decimalShiftZero
      )
      await token.transferOwnership(homeBridgeWithThreeSigs.address)

      const value = ether('0.5')
      const transactionHash = '0x806335163828a8eda675cff9c84fa6e6c7cf06bb44cc6ec832e42fe789d01415'

      const { logs } = await homeBridgeWithThreeSigs.executeAffirmation(recipient, value, transactionHash, {
        from: authoritiesFiveAccs[0]
      }).should.be.fulfilled
      expectEventInLogs(logs, 'SignedForAffirmation', {
        signer: authorities[0],
        transactionHash
      })

      await homeBridgeWithThreeSigs.executeAffirmation(recipient, value, transactionHash, {
        from: authoritiesFiveAccs[1]
      }).should.be.fulfilled
      const thirdSignature = await homeBridgeWithThreeSigs.executeAffirmation(recipient, value, transactionHash, {
        from: authoritiesFiveAccs[2]
      }).should.be.fulfilled

      expectEventInLogs(thirdSignature.logs, 'AffirmationCompleted', {
        recipient,
        value,
        transactionHash
      })
    })
    it('should not allow execute affirmation over foreign max tx limit', async () => {
      const recipient = accounts[5]
      const value = oneEther
      const transactionHash = '0x806335163828a8eda675cff9c84fa6e6c7cf06bb44cc6ec832e42fe789d01415'
      const { logs } = await homeBridge.executeAffirmation(recipient, value, transactionHash, {
        from: authorities[0]
      }).should.be.fulfilled

      expectEventInLogs(logs, 'AmountLimitExceeded', {
        recipient,
        value,
        transactionHash
      })
    })
    it('should fail if txHash already set as above of limits', async () => {
      const recipient = accounts[5]
      const value = oneEther
      const transactionHash = '0x806335163828a8eda675cff9c84fa6e6c7cf06bb44cc6ec832e42fe789d01415'
      const { logs } = await homeBridge.executeAffirmation(recipient, value, transactionHash, {
        from: authorities[0]
      }).should.be.fulfilled

      expectEventInLogs(logs, 'AmountLimitExceeded', {
        recipient,
        value,
        transactionHash
      })

      await homeBridge
        .executeAffirmation(recipient, value, transactionHash, { from: authorities[0] })
        .should.be.rejectedWith(ERROR_MSG)
      await homeBridge
        .executeAffirmation(accounts[6], value, transactionHash, { from: authorities[0] })
        .should.be.rejectedWith(ERROR_MSG)
    })
    it('should not allow execute affirmation over daily foreign limit', async () => {
      const recipient = accounts[5]
      const value = halfEther
      const transactionHash = '0x806335163828a8eda675cff9c84fa6e6c7cf06bb44cc6ec832e42fe789d01415'
      const { logs } = await homeBridge.executeAffirmation(recipient, value, transactionHash, {
        from: authorities[0]
      }).should.be.fulfilled

      expectEventInLogs(logs, 'SignedForAffirmation', {
        signer: authorities[0],
        transactionHash
      })
      expectEventInLogs(logs, 'AffirmationCompleted', {
        recipient,
        value,
        transactionHash
      })

      const transactionHash2 = '0x35d3818e50234655f6aebb2a1cfbf30f59568d8a4ec72066fac5a25dbe7b8121'
      const { logs: logs2 } = await homeBridge.executeAffirmation(recipient, value, transactionHash2, {
        from: authorities[0]
      }).should.be.fulfilled

      expectEventInLogs(logs2, 'SignedForAffirmation', {
        signer: authorities[0],
        transactionHash: transactionHash2
      })
      expectEventInLogs(logs2, 'AffirmationCompleted', {
        recipient,
        value,
        transactionHash: transactionHash2
      })

      const transactionHash3 = '0x69debd8fd1923c9cb3cd8ef6461e2740b2d037943b941729d5a47671a2bb8712'
      const { logs: logs3 } = await homeBridge.executeAffirmation(recipient, value, transactionHash3, {
        from: authorities[0]
      }).should.be.fulfilled

      expectEventInLogs(logs3, 'AmountLimitExceeded', {
        recipient,
        value,
        transactionHash: transactionHash3
      })

      const outOfLimitAmount = await homeBridge.outOfLimitAmount()

      outOfLimitAmount.should.be.bignumber.equal(halfEther)

      const transactionHash4 = '0xc9ffe298d85ec5c515153608924b7bdcf1835539813dcc82cdbcc071170c3196'
      const { logs: logs4 } = await homeBridge.executeAffirmation(recipient, value, transactionHash4, {
        from: authorities[0]
      }).should.be.fulfilled

      expectEventInLogs(logs4, 'AmountLimitExceeded', {
        recipient,
        value,
        transactionHash: transactionHash4
      })

      expect(await homeBridge.outOfLimitAmount()).to.be.bignumber.equal(oneEther)
    })
  })
  describe('#isAlreadyProcessed', async () => {
    it('returns ', async () => {
      const homeBridge = await HomeBridge.new()
      const bn = toBN(2).pow(toBN(255))
      const processedNumbers = [bn.add(toBN(1)).toString(10), bn.add(toBN(100)).toString(10)]
      true.should.be.equal(await homeBridge.isAlreadyProcessed(processedNumbers[0]))
      true.should.be.equal(await homeBridge.isAlreadyProcessed(processedNumbers[1]))
      false.should.be.equal(await homeBridge.isAlreadyProcessed(10))
    })
  })

  describe('#submitSignature', async () => {
    let validatorContractWith2Signatures
    let authoritiesThreeAccs
    let ownerOfValidators
    let homeBridgeWithTwoSigs
    beforeEach(async () => {
      const token2sig = await ERC677BridgeToken.new('Some ERC20', 'RSZT', 18)
      validatorContractWith2Signatures = await BridgeValidators.new()
      authoritiesThreeAccs = [accounts[1], accounts[2], accounts[3]]
      ownerOfValidators = accounts[0]
      await validatorContractWith2Signatures.initialize(2, authoritiesThreeAccs, ownerOfValidators)
      homeBridgeWithTwoSigs = await HomeBridge.new()
      await homeBridgeWithTwoSigs.initialize(
        validatorContractWith2Signatures.address,
        [oneEther, halfEther, minPerTx],
        gasPrice,
        requireBlockConfirmations,
        token2sig.address,
        [foreignDailyLimit, foreignMaxPerTx],
        owner,
        decimalShiftZero
      )
      await token2sig.transferOwnership(homeBridgeWithTwoSigs.address)
    })
    it('allows a validator to submit a signature', async () => {
      const recipientAccount = accounts[8]
      const value = ether('0.5')
      const transactionHash = '0x1045bfe274b88120a6b1e5d01b5ec00ab5d01098346e90e7c7a3c9b8f0181c80'
      const message = createMessage(recipientAccount, value, transactionHash, homeBridgeWithTwoSigs.address)
      const signature = await sign(authoritiesThreeAccs[0], message)
      const { logs } = await homeBridgeWithTwoSigs.submitSignature(signature, message, {
        from: authorities[0]
      }).should.be.fulfilled
      logs[0].event.should.be.equal('SignedForUserRequest')
      const msgHashFromLog = logs[0].args.messageHash
      const signatureFromContract = await homeBridgeWithTwoSigs.signature(msgHashFromLog, 0)
      const messageFromContract = await homeBridgeWithTwoSigs.message(msgHashFromLog)

      signature.should.be.equal(signatureFromContract)
      messageFromContract.should.be.equal(messageFromContract)
      const hashMsg = web3.utils.soliditySha3(message)
      expect(await homeBridgeWithTwoSigs.numMessagesSigned(hashMsg)).to.be.bignumber.equal('1')
      const hashSenderMsg = web3.utils.soliditySha3(authorities[0], hashMsg)
      true.should.be.equal(await homeBridgeWithTwoSigs.messagesSigned(hashSenderMsg))
    })
    it('when enough requiredSignatures are collected, CollectedSignatures event is emitted', async () => {
      const recipientAccount = accounts[8]
      const value = ether('0.5')
      const transactionHash = '0x1045bfe274b88120a6b1e5d01b5ec00ab5d01098346e90e7c7a3c9b8f0181c80'
      const message = createMessage(recipientAccount, value, transactionHash, homeBridgeWithTwoSigs.address)
      const hashMsg = web3.utils.soliditySha3(message)
      const signature = await sign(authoritiesThreeAccs[0], message)
      const signature2 = await sign(authoritiesThreeAccs[1], message)
      expect(await validatorContractWith2Signatures.requiredSignatures()).to.be.bignumber.equal('2')
      await homeBridgeWithTwoSigs.submitSignature(signature, message, {
        from: authoritiesThreeAccs[0]
      }).should.be.fulfilled
      await homeBridgeWithTwoSigs
        .submitSignature(signature, message, { from: authoritiesThreeAccs[0] })
        .should.be.rejectedWith(ERROR_MSG)
      await homeBridgeWithTwoSigs
        .submitSignature(signature, message, { from: authoritiesThreeAccs[1] })
        .should.be.rejectedWith(ERROR_MSG)
      const { logs } = await homeBridgeWithTwoSigs.submitSignature(signature2, message, {
        from: authoritiesThreeAccs[1]
      }).should.be.fulfilled
      logs.length.should.be.equal(2)
      logs[1].event.should.be.equal('CollectedSignatures')
      logs[1].args.authorityResponsibleForRelay.should.be.equal(authoritiesThreeAccs[1])
      const markedAsProcessed = toBN(2)
        .pow(toBN(255))
        .add(toBN(2))
      markedAsProcessed.should.be.bignumber.equal(await homeBridgeWithTwoSigs.numMessagesSigned(hashMsg))
    })
    it('works with 5 validators and 3 required signatures', async () => {
      const recipientAccount = accounts[8]
      const authoritiesFiveAccs = [accounts[1], accounts[2], accounts[3], accounts[4], accounts[5]]
      const validatorContractWith3Signatures = await BridgeValidators.new()
      await validatorContractWith3Signatures.initialize(3, authoritiesFiveAccs, ownerOfValidators)
      const token = await ERC677BridgeToken.new('Some ERC20', 'RSZT', 18)

      const homeBridgeWithThreeSigs = await HomeBridge.new()
      await homeBridgeWithThreeSigs.initialize(
        validatorContractWith3Signatures.address,
        [oneEther, halfEther, minPerTx],
        gasPrice,
        requireBlockConfirmations,
        token.address,
        [foreignDailyLimit, foreignMaxPerTx],
        owner,
        decimalShiftZero
      )

      const value = ether('0.5')
      const transactionHash = '0x1045bfe274b88120a6b1e5d01b5ec00ab5d01098346e90e7c7a3c9b8f0181c80'
      const message = createMessage(recipientAccount, value, transactionHash, homeBridgeWithThreeSigs.address)
      const signature = await sign(authoritiesFiveAccs[0], message)
      const signature2 = await sign(authoritiesFiveAccs[1], message)
      const signature3 = await sign(authoritiesFiveAccs[2], message)
      expect(await validatorContractWith3Signatures.requiredSignatures()).to.be.bignumber.equal('3')

      await homeBridgeWithThreeSigs.submitSignature(signature, message, {
        from: authoritiesFiveAccs[0]
      }).should.be.fulfilled
      await homeBridgeWithThreeSigs.submitSignature(signature2, message, {
        from: authoritiesFiveAccs[1]
      }).should.be.fulfilled
      const { logs } = await homeBridgeWithThreeSigs.submitSignature(signature3, message, {
        from: authoritiesFiveAccs[2]
      }).should.be.fulfilled
      logs.length.should.be.equal(2)
      logs[1].event.should.be.equal('CollectedSignatures')
      logs[1].args.authorityResponsibleForRelay.should.be.equal(authoritiesFiveAccs[2])
    })
    it('attack when increasing requiredSignatures', async () => {
      const recipientAccount = accounts[8]
      const value = ether('0.5')
      const transactionHash = '0x1045bfe274b88120a6b1e5d01b5ec00ab5d01098346e90e7c7a3c9b8f0181c80'
      const message = createMessage(recipientAccount, value, transactionHash, homeBridgeWithTwoSigs.address)
      const signature = await sign(authoritiesThreeAccs[0], message)
      const signature2 = await sign(authoritiesThreeAccs[1], message)
      const signature3 = await sign(authoritiesThreeAccs[2], message)
      expect(await validatorContractWith2Signatures.requiredSignatures()).to.be.bignumber.equal('2')

      await homeBridgeWithTwoSigs.submitSignature(signature, message, {
        from: authoritiesThreeAccs[0]
      }).should.be.fulfilled
      await homeBridgeWithTwoSigs
        .submitSignature(signature, message, { from: authoritiesThreeAccs[0] })
        .should.be.rejectedWith(ERROR_MSG)
      await homeBridgeWithTwoSigs
        .submitSignature(signature, message, { from: authoritiesThreeAccs[1] })
        .should.be.rejectedWith(ERROR_MSG)
      const { logs } = await homeBridgeWithTwoSigs.submitSignature(signature2, message, {
        from: authoritiesThreeAccs[1]
      }).should.be.fulfilled
      logs.length.should.be.equal(2)
      logs[1].event.should.be.equal('CollectedSignatures')
      logs[1].args.authorityResponsibleForRelay.should.be.equal(authoritiesThreeAccs[1])
      await validatorContractWith2Signatures.setRequiredSignatures(3).should.be.fulfilled
      expect(await validatorContractWith2Signatures.requiredSignatures()).to.be.bignumber.equal('3')

      await homeBridgeWithTwoSigs
        .submitSignature(signature3, message, { from: authoritiesThreeAccs[2] })
        .should.be.rejectedWith(ERROR_MSG)
    })
    it('attack when decreasing requiredSignatures', async () => {
      const recipientAccount = accounts[8]
      const value = ether('0.5')
      const transactionHash = '0x1045bfe274b88120a6b1e5d01b5ec00ab5d01098346e90e7c7a3c9b8f0181c80'
      const message = createMessage(recipientAccount, value, transactionHash, homeBridgeWithTwoSigs.address)
      const signature = await sign(authoritiesThreeAccs[0], message)
      const signature2 = await sign(authoritiesThreeAccs[1], message)

      expect(await validatorContractWith2Signatures.requiredSignatures()).to.be.bignumber.equal('2')

      await homeBridgeWithTwoSigs.submitSignature(signature, message, {
        from: authoritiesThreeAccs[0]
      }).should.be.fulfilled
      await validatorContractWith2Signatures.setRequiredSignatures(1).should.be.fulfilled

      expect(await validatorContractWith2Signatures.requiredSignatures()).to.be.bignumber.equal('1')
      const { logs } = await homeBridgeWithTwoSigs.submitSignature(signature2, message, {
        from: authoritiesThreeAccs[1]
      }).should.be.fulfilled
      logs.length.should.be.equal(2)
      logs[1].event.should.be.equal('CollectedSignatures')
      logs[1].args.authorityResponsibleForRelay.should.be.equal(authoritiesThreeAccs[1])
    })
  })

  describe('#requiredMessageLength', async () => {
    beforeEach(async () => {
      homeContract = await HomeBridge.new()
    })

    it('should return the required message length', async () => {
      const requiredMessageLength = await homeContract.requiredMessageLength()
      expect(requiredMessageLength).to.be.bignumber.equal('104')
    })
  })

  describe('#fixAssetsAboveLimits', async () => {
    let homeBridge
    beforeEach(async () => {
      const homeBridgeImpl = await HomeBridge.new()
      const storageProxy = await EternalStorageProxy.new().should.be.fulfilled
      await storageProxy.upgradeTo('1', homeBridgeImpl.address).should.be.fulfilled
      homeBridge = await HomeBridge.at(storageProxy.address)
      await homeBridge.initialize(
        validatorContract.address,
        [oneEther, halfEther, minPerTx],
        gasPrice,
        requireBlockConfirmations,
        token.address,
        [foreignDailyLimit, foreignMaxPerTx],
        owner,
        decimalShiftZero
      ).should.be.fulfilled
    })
    it('Should revert if value to unlock is bigger than max per transaction', async () => {
      const recipient = accounts[5]
      const value = oneEther
      const transactionHash = '0x806335163828a8eda675cff9c84fa6e6c7cf06bb44cc6ec832e42fe789d01415'
      const { logs: affirmationLogs } = await homeBridge.executeAffirmation(recipient, value, transactionHash, {
        from: authorities[0]
      }).should.be.fulfilled

      affirmationLogs[0].event.should.be.equal('AmountLimitExceeded')

      const outOfLimitAmount = await homeBridge.outOfLimitAmount()
      outOfLimitAmount.should.be.bignumber.equal(value)

      await homeBridge.fixAssetsAboveLimits(transactionHash, false, value).should.be.rejectedWith(ERROR_MSG)
    })
    it('Should allow to partially reduce outOfLimitAmount and not emit UserRequestForSignature', async () => {
      const recipient = accounts[5]
      const value = oneEther
      const transactionHash = '0x806335163828a8eda675cff9c84fa6e6c7cf06bb44cc6ec832e42fe789d01415'
      const { logs: affirmationLogs } = await homeBridge.executeAffirmation(recipient, value, transactionHash, {
        from: authorities[0]
      }).should.be.fulfilled

      affirmationLogs[0].event.should.be.equal('AmountLimitExceeded')

      const outOfLimitAmount = await homeBridge.outOfLimitAmount()
      outOfLimitAmount.should.be.bignumber.equal(value)

      const { logs } = await homeBridge.fixAssetsAboveLimits(transactionHash, false, halfEther).should.be.fulfilled

      logs.length.should.be.equal(1)
      expectEventInLogs(logs, 'AssetAboveLimitsFixed', {
        transactionHash,
        value: halfEther,
        remaining: halfEther
      })
      expect(await homeBridge.outOfLimitAmount()).to.be.bignumber.equal(halfEther)

      const { logs: logsSecondTx } = await homeBridge.fixAssetsAboveLimits(transactionHash, false, halfEther).should.be
        .fulfilled

      logsSecondTx.length.should.be.equal(1)
      expectEventInLogs(logsSecondTx, 'AssetAboveLimitsFixed', {
        transactionHash,
        value: halfEther,
        remaining: ZERO
      })
      expect(await homeBridge.outOfLimitAmount()).to.be.bignumber.equal(ZERO)
    })
    it('Should allow to partially reduce outOfLimitAmount and emit UserRequestForSignature', async () => {
      const recipient = accounts[5]
      const value = oneEther
      const transactionHash = '0x806335163828a8eda675cff9c84fa6e6c7cf06bb44cc6ec832e42fe789d01415'
      const { logs: affirmationLogs } = await homeBridge.executeAffirmation(recipient, value, transactionHash, {
        from: authorities[0]
      }).should.be.fulfilled

      affirmationLogs[0].event.should.be.equal('AmountLimitExceeded')

      const outOfLimitAmount = await homeBridge.outOfLimitAmount()
      outOfLimitAmount.should.be.bignumber.equal(value)

      const { logs } = await homeBridge.fixAssetsAboveLimits(transactionHash, true, halfEther).should.be.fulfilled

      logs.length.should.be.equal(2)
      expectEventInLogs(logs, 'AssetAboveLimitsFixed', {
        transactionHash,
        value: halfEther,
        remaining: halfEther
      })
      expectEventInLogs(logs, 'UserRequestForSignature', {
        recipient,
        value: halfEther
      })

      expect(await homeBridge.outOfLimitAmount()).to.be.bignumber.equal(halfEther)

      const { logs: logsSecondTx } = await homeBridge.fixAssetsAboveLimits(transactionHash, true, halfEther).should.be
        .fulfilled

      logsSecondTx.length.should.be.equal(2)
      expectEventInLogs(logsSecondTx, 'AssetAboveLimitsFixed', {
        transactionHash,
        value: halfEther,
        remaining: ZERO
      })
      expectEventInLogs(logsSecondTx, 'UserRequestForSignature', {
        recipient,
        value: halfEther
      })

      expect(await homeBridge.outOfLimitAmount()).to.be.bignumber.equal(ZERO)
    })
    it('Should revert if try to unlock more than available', async () => {
      const recipient = accounts[5]
      const value = oneEther
      const transactionHash = '0x806335163828a8eda675cff9c84fa6e6c7cf06bb44cc6ec832e42fe789d01415'
      const { logs: affirmationLogs } = await homeBridge.executeAffirmation(recipient, value, transactionHash, {
        from: authorities[0]
      }).should.be.fulfilled

      affirmationLogs[0].event.should.be.equal('AmountLimitExceeded')

      const outOfLimitAmount = await homeBridge.outOfLimitAmount()
      outOfLimitAmount.should.be.bignumber.equal(value)

      const { logs } = await homeBridge.fixAssetsAboveLimits(transactionHash, true, halfEther).should.be.fulfilled

      logs.length.should.be.equal(2)
      expectEventInLogs(logs, 'AssetAboveLimitsFixed', {
        transactionHash,
        value: halfEther,
        remaining: halfEther
      })
      expectEventInLogs(logs, 'UserRequestForSignature', {
        recipient,
        value: halfEther
      })

      expect(await homeBridge.outOfLimitAmount()).to.be.bignumber.equal(halfEther)

      const { logs: logsSecondTx } = await homeBridge.fixAssetsAboveLimits(transactionHash, true, quarterEther).should
        .be.fulfilled

      logsSecondTx.length.should.be.equal(2)
      expectEventInLogs(logsSecondTx, 'AssetAboveLimitsFixed', {
        transactionHash,
        value: quarterEther,
        remaining: quarterEther
      })
      expectEventInLogs(logsSecondTx, 'UserRequestForSignature', {
        recipient,
        value: quarterEther
      })

      expect(await homeBridge.outOfLimitAmount()).to.be.bignumber.equal(quarterEther)

      await homeBridge.fixAssetsAboveLimits(transactionHash, true, halfEther).should.be.rejectedWith(ERROR_MSG)
      const { logs: logsThirdTx } = await homeBridge.fixAssetsAboveLimits(transactionHash, true, quarterEther).should.be
        .fulfilled
      expectEventInLogs(logsThirdTx, 'AssetAboveLimitsFixed', {
        transactionHash,
        value: quarterEther,
        remaining: ZERO
      })
      expectEventInLogs(logsThirdTx, 'UserRequestForSignature', {
        recipient,
        value: quarterEther
      })

      expect(await homeBridge.outOfLimitAmount()).to.be.bignumber.equal(ZERO)
    })
    it('Should not be allow to be called by an already fixed txHash', async () => {
      const recipient = accounts[5]
      const value = oneEther
      const transactionHash = '0x806335163828a8eda675cff9c84fa6e6c7cf06bb44cc6ec832e42fe789d01415'
      const transactionHash2 = '0x35d3818e50234655f6aebb2a1cfbf30f59568d8a4ec72066fac5a25dbe7b8121'

      await homeBridge.executeAffirmation(recipient, value, transactionHash, {
        from: authorities[0]
      }).should.be.fulfilled
      await homeBridge.executeAffirmation(recipient, value, transactionHash2, {
        from: authorities[0]
      }).should.be.fulfilled

      const outOfLimitAmount = await homeBridge.outOfLimitAmount()
      outOfLimitAmount.should.be.bignumber.equal(value.add(value))

      await homeBridge.fixAssetsAboveLimits(transactionHash, false, halfEther).should.be.fulfilled
      await homeBridge.fixAssetsAboveLimits(transactionHash, false, halfEther).should.be.fulfilled

      const newOutOfLimitAmount = await homeBridge.outOfLimitAmount()
      newOutOfLimitAmount.should.be.bignumber.equal(value)

      await homeBridge.fixAssetsAboveLimits(transactionHash, false, halfEther).should.be.rejectedWith(ERROR_MSG)

      await homeBridge.fixAssetsAboveLimits(transactionHash2, false, halfEther).should.be.fulfilled
      await homeBridge.fixAssetsAboveLimits(transactionHash2, false, halfEther).should.be.fulfilled

      expect(await homeBridge.outOfLimitAmount()).to.be.bignumber.equal(ZERO)

      await homeBridge.fixAssetsAboveLimits(transactionHash2, false, halfEther).should.be.rejectedWith(ERROR_MSG)
    })
    it('Should fail if txHash didnt increase out of limit amount', async () => {
      const recipient = accounts[5]
      const value = oneEther
      const transactionHash = '0x806335163828a8eda675cff9c84fa6e6c7cf06bb44cc6ec832e42fe789d01415'
      const invalidTxHash = '0x35d3818e50234655f6aebb2a1cfbf30f59568d8a4ec72066fac5a25dbe7b8121'

      const { logs: affirmationLogs } = await homeBridge.executeAffirmation(recipient, value, transactionHash, {
        from: authorities[0]
      }).should.be.fulfilled

      affirmationLogs[0].event.should.be.equal('AmountLimitExceeded')

      await homeBridge.fixAssetsAboveLimits(invalidTxHash, true, halfEther).should.be.rejectedWith(ERROR_MSG)
    })
    it('Should fail if not called by proxyOwner', async () => {
      const recipient = accounts[5]
      const value = oneEther
      const transactionHash = '0x806335163828a8eda675cff9c84fa6e6c7cf06bb44cc6ec832e42fe789d01415'

      const { logs: affirmationLogs } = await homeBridge.executeAffirmation(recipient, value, transactionHash, {
        from: authorities[0]
      }).should.be.fulfilled

      affirmationLogs[0].event.should.be.equal('AmountLimitExceeded')

      await homeBridge
        .fixAssetsAboveLimits(transactionHash, true, halfEther, { from: recipient })
        .should.be.rejectedWith(ERROR_MSG)
      await homeBridge.fixAssetsAboveLimits(transactionHash, true, halfEther, { from: owner }).should.be.fulfilled
    })
    it('Should emit UserRequestForSignature with value reduced by fee', async () => {
      const recipient = accounts[5]
      const value = oneEther
      const transactionHash = '0x806335163828a8eda675cff9c84fa6e6c7cf06bb44cc6ec832e42fe789d01415'

      const feeManager = await FeeManagerErcToErcPOSDAO.new()
      const fee = 0.001
      const feeInWei = ether(fee.toString())
      const valueCalc = 0.5 * (1 - fee)
      const finalValue = ether(valueCalc.toString())
      await homeBridge.setFeeManagerContract(feeManager.address, { from: owner }).should.be.fulfilled
      await homeBridge.setHomeFee(feeInWei, { from: owner }).should.be.fulfilled

      const { logs: affirmationLogs } = await homeBridge.executeAffirmation(recipient, value, transactionHash, {
        from: authorities[0]
      }).should.be.fulfilled

      expectEventInLogs(affirmationLogs, 'AmountLimitExceeded', {
        recipient,
        value,
        transactionHash
      })

      const outOfLimitAmount = await homeBridge.outOfLimitAmount()
      outOfLimitAmount.should.be.bignumber.equal(value)

      const { logs } = await homeBridge.fixAssetsAboveLimits(transactionHash, true, halfEther).should.be.fulfilled

      logs.length.should.be.equal(2)
      expectEventInLogs(logs, 'AssetAboveLimitsFixed', {
        transactionHash,
        value: halfEther,
        remaining: halfEther
      })
      expectEventInLogs(logs, 'UserRequestForSignature', {
        recipient,
        value: finalValue
      })
    })
  })
  describe('#claimTokens', () => {
    it('should be able to call claimTokens on tokenAddress', async () => {
      const token = await ERC677BridgeToken.new('Bridge Token', 'BT20', 18)

      const homeBridgeImpl = await HomeBridge.new()
      const storageProxy = await EternalStorageProxy.new().should.be.fulfilled
      await storageProxy.upgradeTo('1', homeBridgeImpl.address).should.be.fulfilled
      const homeBridge = await HomeBridge.at(storageProxy.address)
      await homeBridge.initialize(
        validatorContract.address,
        [oneEther, halfEther, minPerTx],
        gasPrice,
        requireBlockConfirmations,
        token.address,
        [foreignDailyLimit, foreignMaxPerTx],
        owner,
        decimalShiftZero
      ).should.be.fulfilled

      await token.transferOwnership(homeBridge.address).should.be.fulfilled

      const tokenSecond = await ERC677BridgeToken.new('Test Token', 'TST', 18)

      await tokenSecond.mint(accounts[0], halfEther).should.be.fulfilled
      expect(await tokenSecond.balanceOf(accounts[0])).to.be.bignumber.equal(halfEther)

      await tokenSecond.transfer(token.address, halfEther)
      expect(await tokenSecond.balanceOf(accounts[0])).to.be.bignumber.equal(ZERO)
      expect(await tokenSecond.balanceOf(token.address)).to.be.bignumber.equal(halfEther)

      await homeBridge
        .claimTokensFromErc677(tokenSecond.address, accounts[3], { from: accounts[3] })
        .should.be.rejectedWith(ERROR_MSG)
      await homeBridge.claimTokensFromErc677(tokenSecond.address, accounts[3], { from: owner }).should.be.fulfilled
      expect(await tokenSecond.balanceOf(token.address)).to.be.bignumber.equal(ZERO)
      expect(await tokenSecond.balanceOf(accounts[3])).to.be.bignumber.equal(halfEther)
    })
  })
  describe('#rewardableInitialize', async () => {
    let homeFee
    let foreignFee
    let homeBridge
    let rewardableValidators
    let blockRewardContract
    const validators = [accounts[1]]
    const rewards = [accounts[2]]
    const requiredSignatures = 1
    beforeEach(async () => {
      token = await ERC677BridgeToken.new('Some ERC20', 'RSZT', 18)
      rewardableValidators = await RewardableValidators.new()
      await rewardableValidators.initialize(requiredSignatures, validators, rewards, owner).should.be.fulfilled
      homeBridge = await POSDAOHomeBridge.new()
      homeFee = ether('0.002')
      foreignFee = ether('0.002')
      blockRewardContract = await BlockReward.new()
    })
    it('sets variables', async () => {
      const feeManager = await FeeManagerErcToErcPOSDAO.new()
      expect(await homeBridge.validatorContract()).to.be.equal(ZERO_ADDRESS)
      expect(await homeBridge.deployedAtBlock()).to.be.bignumber.equal(ZERO)
      expect(await homeBridge.dailyLimit()).to.be.bignumber.equal(ZERO)
      expect(await homeBridge.maxPerTx()).to.be.bignumber.equal(ZERO)
      expect(await homeBridge.isInitialized()).to.be.equal(false)

      await homeBridge.rewardableInitialize(
        ZERO_ADDRESS,
        [oneEther, halfEther, minPerTx],
        gasPrice,
        requireBlockConfirmations,
        token.address,
        [foreignDailyLimit, foreignMaxPerTx],
        owner,
        feeManager.address,
        [homeFee, foreignFee],
        blockRewardContract.address,
        decimalShiftZero
      ).should.be.rejected
      await homeBridge.rewardableInitialize(
        rewardableValidators.address,
        [oneEther, halfEther, minPerTx],
        gasPrice,
        [0, foreignDailyLimit],
        token.address,
        foreignMaxPerTx,
        owner,
        feeManager.address,
        [homeFee, foreignFee],
        blockRewardContract.address,
        decimalShiftZero
      ).should.be.rejected
      await homeBridge.rewardableInitialize(
        rewardableValidators.address,
        [oneEther, halfEther, minPerTx],
        gasPrice,
        requireBlockConfirmations,
        token.address,
        [foreignDailyLimit, foreignMaxPerTx],
        owner,
        ZERO_ADDRESS,
        [homeFee, foreignFee],
        blockRewardContract.address,
        decimalShiftZero
      ).should.be.rejected
      const { logs } = await homeBridge.rewardableInitialize(
        rewardableValidators.address,
        [oneEther, halfEther, minPerTx],
        gasPrice,
        requireBlockConfirmations,
        token.address,
        [foreignDailyLimit, foreignMaxPerTx],
        owner,
        feeManager.address,
        [homeFee, foreignFee],
        blockRewardContract.address,
        '9'
      ).should.be.fulfilled

      expect(await homeBridge.isInitialized()).to.be.equal(true)
      expect(await homeBridge.validatorContract()).to.be.equal(rewardableValidators.address)
      expect(await homeBridge.deployedAtBlock()).to.be.bignumber.above(ZERO)
      expect(await homeBridge.dailyLimit()).to.be.bignumber.equal(oneEther)
      expect(await homeBridge.maxPerTx()).to.be.bignumber.equal(halfEther)
      expect(await homeBridge.minPerTx()).to.be.bignumber.equal(minPerTx)
      expect(await homeBridge.decimalShift()).to.be.bignumber.equal('9')
      const bridgeMode = '0xba4690f5' // 4 bytes of keccak256('erc-to-erc-core')
      expect(await homeBridge.getBridgeMode()).to.be.equal(bridgeMode)
      const { major, minor, patch } = await homeBridge.getBridgeInterfacesVersion()
      expect(major).to.be.bignumber.gte(ZERO)
      expect(minor).to.be.bignumber.gte(ZERO)
      expect(patch).to.be.bignumber.gte(ZERO)

      const feeManagerContract = await homeBridge.feeManagerContract()
      feeManagerContract.should.be.equals(feeManager.address)
      const bridgeHomeFee = await homeBridge.getHomeFee()
      bridgeHomeFee.should.be.bignumber.equal(homeFee)
      const bridgeForeignFee = await homeBridge.getForeignFee()
      bridgeForeignFee.should.be.bignumber.equal(foreignFee)
      const blockReward = await homeBridge.blockRewardContract()
      blockReward.should.be.equals(blockRewardContract.address)

      expectEventInLogs(logs, 'RequiredBlockConfirmationChanged', {
        requiredBlockConfirmations: toBN(requireBlockConfirmations)
      })
      expectEventInLogs(logs, 'GasPriceChanged', { gasPrice })
      expectEventInLogs(logs, 'DailyLimitChanged', { newLimit: oneEther })
      expectEventInLogs(logs, 'ExecutionDailyLimitChanged', { newLimit: foreignDailyLimit })
    })
    it('can update fee contract', async () => {
      const feeManager = await FeeManagerErcToErcPOSDAO.new()
      await homeBridge.rewardableInitialize(
        rewardableValidators.address,
        [oneEther, halfEther, minPerTx],
        gasPrice,
        requireBlockConfirmations,
        token.address,
        [foreignDailyLimit, foreignMaxPerTx],
        owner,
        feeManager.address,
        [homeFee, foreignFee],
        blockRewardContract.address,
        decimalShiftZero
      ).should.be.fulfilled

      // Given
      const newFeeManager = await FeeManagerErcToErcPOSDAO.new()

      // When
      await homeBridge.setFeeManagerContract(newFeeManager.address, { from: owner }).should.be.fulfilled

      // Then
      const feeManagerContract = await homeBridge.feeManagerContract()
      feeManagerContract.should.be.equals(newFeeManager.address)
    })
    it('can update fee', async () => {
      const feeManager = await FeeManagerErcToErcPOSDAO.new()
      await homeBridge.rewardableInitialize(
        rewardableValidators.address,
        [oneEther, halfEther, minPerTx],
        gasPrice,
        requireBlockConfirmations,
        token.address,
        [foreignDailyLimit, foreignMaxPerTx],
        owner,
        feeManager.address,
        [homeFee, foreignFee],
        blockRewardContract.address,
        decimalShiftZero
      ).should.be.fulfilled

      // Given
      const newHomeFee = ether('0.1')
      const newForeignFee = ether('0.4')

      // When
      await homeBridge.setHomeFee(newHomeFee, { from: owner }).should.be.fulfilled
      await homeBridge.setForeignFee(newForeignFee, { from: owner }).should.be.fulfilled

      // Then
      const bridgeHomeFee = await homeBridge.getHomeFee()
      const bridgeForeignFee = await homeBridge.getForeignFee()
      bridgeHomeFee.should.be.bignumber.equal(newHomeFee)
      bridgeForeignFee.should.be.bignumber.equal(newForeignFee)
    })
    it('fee should be less than 100%', async () => {
      const feeManager = await FeeManagerErcToErcPOSDAO.new()
      await homeBridge.rewardableInitialize(
        rewardableValidators.address,
        [oneEther, halfEther, minPerTx],
        gasPrice,
        requireBlockConfirmations,
        token.address,
        [foreignDailyLimit, foreignMaxPerTx],
        owner,
        feeManager.address,
        [homeFee, foreignFee],
        blockRewardContract.address,
        decimalShiftZero
      ).should.be.fulfilled

      // Given
      const invalidFee = ether('1')
      const invalidBigFee = ether('2')
      const newHomeFee = ether('0.99')
      const newForeignFee = ether('0.99')

      // When
      await homeBridge.setHomeFee(invalidFee, { from: owner }).should.be.rejectedWith(ERROR_MSG)
      await homeBridge.setForeignFee(invalidFee, { from: owner }).should.be.rejectedWith(ERROR_MSG)

      await homeBridge.setHomeFee(invalidBigFee, { from: owner }).should.be.rejectedWith(ERROR_MSG)
      await homeBridge.setForeignFee(invalidBigFee, { from: owner }).should.be.rejectedWith(ERROR_MSG)

      await homeBridge.setHomeFee(newHomeFee, { from: owner }).should.be.fulfilled
      await homeBridge.setForeignFee(newForeignFee, { from: owner }).should.be.fulfilled

      // Then
      expect(await homeBridge.getHomeFee()).to.be.bignumber.equals(newHomeFee)
      expect(await homeBridge.getForeignFee()).to.be.bignumber.equals(newForeignFee)
    })
    it('should be able to get fee manager mode', async () => {
      // Given
      const feeManager = await FeeManagerErcToErcPOSDAO.new()
      const bothDirectionsModeHash = '0xd7de965f'

      // When
      await homeBridge.rewardableInitialize(
        rewardableValidators.address,
        [oneEther, halfEther, minPerTx],
        gasPrice,
        requireBlockConfirmations,
        token.address,
        [foreignDailyLimit, foreignMaxPerTx],
        owner,
        feeManager.address,
        [homeFee, foreignFee],
        blockRewardContract.address,
        decimalShiftZero
      ).should.be.fulfilled

      // Then
      const feeManagerMode = await homeBridge.getFeeManagerMode()
      feeManagerMode.should.be.equals(bothDirectionsModeHash)
    })
    it('should be able to set blockReward contract', async () => {
      // Given
      const feeManager = await FeeManagerErcToErcPOSDAO.new()

      await homeBridge.rewardableInitialize(
        rewardableValidators.address,
        [oneEther, halfEther, minPerTx],
        gasPrice,
        requireBlockConfirmations,
        token.address,
        [foreignDailyLimit, foreignMaxPerTx],
        owner,
        feeManager.address,
        [homeFee, foreignFee],
        blockRewardContract.address,
        decimalShiftZero
      ).should.be.fulfilled

      const blockReward = await homeBridge.blockRewardContract()
      blockReward.should.be.equals(blockRewardContract.address)

      // When
      const newBlockRewardContract = await BlockReward.new()
      await homeBridge.setBlockRewardContract(newBlockRewardContract.address).should.be.fulfilled

      // Then
      const newBlockReward = await homeBridge.blockRewardContract()
      newBlockReward.should.be.equals(newBlockRewardContract.address)

      const oldBlockRewardContract = await OldBlockReward.new()
      await homeBridge.setBlockRewardContract(oldBlockRewardContract.address).should.be.fulfilled
      oldBlockRewardContract.address.should.be.equal(await homeBridge.blockRewardContract())
    })
  })
  describe('#onTokenTransfer', async () => {
    let homeBridge
    beforeEach(async () => {
      homeBridge = await HomeBridge.new()
      token = await ERC677BridgeToken.new('Some ERC20', 'TEST', 18)
    })
    it('should trigger UserRequestForSignature with transfer value', async () => {
      // Given
      const owner = accounts[0]
      const user = accounts[4]
      await homeBridge.initialize(
        validatorContract.address,
        [oneEther, halfEther, minPerTx],
        gasPrice,
        requireBlockConfirmations,
        token.address,
        [foreignDailyLimit, foreignMaxPerTx],
        owner,
        decimalShiftZero
      ).should.be.fulfilled
      const value = halfEther
      await token.mint(user, value, { from: owner }).should.be.fulfilled

      // When
      await token.transferAndCall(homeBridge.address, value, '0x', { from: user }).should.be.fulfilled

      // Then
      const events = await getEvents(homeBridge, { event: 'UserRequestForSignature' })
      expect(events[0].returnValues.recipient).to.be.equal(user)
      expect(toBN(events[0].returnValues.value)).to.be.bignumber.equal(value)
    })
    it('should be able to specify a different receiver', async () => {
      // Given
      const owner = accounts[0]
      const user = accounts[4]
      const user2 = accounts[5]
      await homeBridge.initialize(
        validatorContract.address,
        [oneEther, halfEther, minPerTx],
        gasPrice,
        requireBlockConfirmations,
        token.address,
        [foreignDailyLimit, foreignMaxPerTx],
        owner,
        decimalShiftZero
      ).should.be.fulfilled
      const value = halfEther
      await token.mint(user, value, { from: owner }).should.be.fulfilled

      // When
      await token
        .transferAndCall(homeBridge.address, value, ZERO_ADDRESS, { from: user })
        .should.be.rejectedWith(ERROR_MSG)
      await token.transferAndCall(homeBridge.address, value, user2, { from: user }).should.be.fulfilled

      // Then
      const events = await getEvents(homeBridge, { event: 'UserRequestForSignature' })
      expect(events[0].returnValues.recipient).to.be.equal(user2)
      expect(toBN(events[0].returnValues.value)).to.be.bignumber.equal(value)
    })
    it('should trigger UserRequestForSignature with fee subtracted', async () => {
      // Given
      const homeBridge = await POSDAOHomeBridge.new()
      const owner = accounts[0]
      const user = accounts[4]
      const validators = [accounts[1]]
      const rewards = [accounts[2]]
      const requiredSignatures = 1
      const blockRewardContract = await BlockReward.new()
      const rewardableValidators = await RewardableValidators.new()
      await rewardableValidators.initialize(requiredSignatures, validators, rewards, owner).should.be.fulfilled
      const feeManager = await FeeManagerErcToErcPOSDAO.new()
      const fee = 0.001
      const homeFee = ether('0.001')
      const foreignFee = ether('0.001')

      await homeBridge.rewardableInitialize(
        rewardableValidators.address,
        [oneEther, halfEther, minPerTx],
        gasPrice,
        requireBlockConfirmations,
        token.address,
        [foreignDailyLimit, foreignMaxPerTx],
        owner,
        feeManager.address,
        [homeFee, foreignFee],
        blockRewardContract.address,
        decimalShiftZero
      ).should.be.fulfilled
      const value = halfEther
      const finalValueCalc = 0.5 * (1 - fee)
      const finalValue = ether(finalValueCalc.toString())
      await token.mint(user, value, { from: owner }).should.be.fulfilled

      // When
      await token.transferAndCall(homeBridge.address, value, '0x', { from: user }).should.be.fulfilled

      // Then
      const events = await getEvents(homeBridge, { event: 'UserRequestForSignature' })
      expect(events[0].returnValues.recipient).to.be.equal(user)
      expect(toBN(events[0].returnValues.value)).to.be.bignumber.equal(finalValue)
    })
  })
  describe('#rewardable_submitSignatures', () => {
    let fee
    let homeFee
    let foreignFee
    let homeBridge
    let rewardableValidators
    let blockRewardContract
    let feeManager
    beforeEach(async () => {
      token = await ERC677BridgeTokenRewardable.new('Some ERC20', 'RSZT', 18, 100)
      rewardableValidators = await RewardableValidators.new()
      feeManager = await FeeManagerErcToErcPOSDAO.new()
      homeBridge = await POSDAOHomeBridge.new()
      fee = 0.001
      homeFee = ether(fee.toString())
      foreignFee = ether(fee.toString())
      blockRewardContract = await BlockReward.new()
      await homeBridge.rewardableInitialize(
        rewardableValidators.address,
        [oneEther, halfEther, minPerTx],
        gasPrice,
        requireBlockConfirmations,
        token.address,
        [foreignDailyLimit, foreignMaxPerTx],
        owner,
        feeManager.address,
        [homeFee, foreignFee],
        blockRewardContract.address,
        decimalShiftZero
      ).should.be.fulfilled
    })
    it('should distribute fee to one validator', async () => {
      // Given
      const recipient = accounts[9]
      const owner = accounts[0]
      const validators = [accounts[1]]
      const rewards = [accounts[2]]
      const requiredSignatures = 1
      await rewardableValidators.initialize(requiredSignatures, validators, rewards, owner).should.be.fulfilled
      await blockRewardContract.setValidatorsRewards(rewards)
      await blockRewardContract.setToken(token.address)
      await token.setBlockRewardContract(blockRewardContract.address, { from: owner })
      await token.transferOwnership(homeBridge.address, { from: owner })

      const valueCalc = 0.5 * (1 - fee)
      const value = ether(valueCalc.toString())
      const feeAmountCalc = 0.5 * fee
      const feeAmount = ether(feeAmountCalc.toString())
      const transactionHash = '0x1045bfe274b88120a6b1e5d01b5ec00ab5d01098346e90e7c7a3c9b8f0181c80'
      const message = createMessage(recipient, value, transactionHash, homeBridge.address)
      const signature = await sign(validators[0], message)

      const blockRewardBalanceBefore = await token.balanceOf(blockRewardContract.address)
      blockRewardBalanceBefore.should.be.bignumber.equal('0')

      // When
      const { logs } = await homeBridge.submitSignature(signature, message, { from: validators[0] }).should.be.fulfilled

      // Then
      logs.length.should.be.equal(3)
      logs[1].event.should.be.equal('CollectedSignatures')
      expectEventInLogs(logs, 'FeeDistributedFromSignatures', {
        feeAmount,
        transactionHash
      })

      const finalBridgeBalance = await token.balanceOf(homeBridge.address)
      finalBridgeBalance.should.be.bignumber.equal('0')

      const feeDistributed = await blockRewardContract.feeAmount()
      feeDistributed.should.be.bignumber.equal(feeAmount)

      const rewardAddressBalanceAfter = await blockRewardContract.validatorRewardList(0)
      rewardAddressBalanceAfter.should.be.bignumber.equal(feeAmount)

      const blockRewardBalanceAfter = await token.balanceOf(blockRewardContract.address)
      blockRewardBalanceAfter.should.be.bignumber.equal(feeAmount)
    })
    it('should distribute fee to 3 validators', async () => {
      // Given
      const recipient = accounts[8]
      const owner = accounts[9]
      const validators = [accounts[1], accounts[2], accounts[3]]
      const rewards = [accounts[4], accounts[5], accounts[6]]
      const requiredSignatures = 2
      await rewardableValidators.initialize(requiredSignatures, validators, rewards, owner).should.be.fulfilled
      await blockRewardContract.setValidatorsRewards(rewards)
      await blockRewardContract.setToken(token.address)
      await token.setBlockRewardContract(blockRewardContract.address)
      await token.transferOwnership(homeBridge.address)

      const calcValue = 0.5 * (1 - fee)
      const value = ether(calcValue.toString())
      const calcFeeAmount = 0.5 * fee
      const feeAmount = ether(calcFeeAmount.toString())
      const feePerValidator = toBN(166666666666666)
      const feePerValidatorPlusDiff = toBN(166666666666668)
      const transactionHash = '0x1045bfe274b88120a6b1e5d01b5ec00ab5d01098346e90e7c7a3c9b8f0181c80'
      const message = createMessage(recipient, value, transactionHash, homeBridge.address)
      const signature = await sign(validators[0], message)
      const signature2 = await sign(validators[1], message)

      // When
      await homeBridge.submitSignature(signature, message, { from: validators[0] }).should.be.fulfilled
      const { logs } = await homeBridge.submitSignature(signature2, message, {
        from: validators[1]
      }).should.be.fulfilled

      // Then
      logs.length.should.be.equal(3)
      logs[1].event.should.be.equal('CollectedSignatures')
      expectEventInLogs(logs, 'FeeDistributedFromSignatures', {
        feeAmount,
        transactionHash
      })

      const finalBridgeBalance = await token.balanceOf(homeBridge.address)
      finalBridgeBalance.should.be.bignumber.equal('0')

      const feeDistributed = await blockRewardContract.feeAmount()
      feeDistributed.should.be.bignumber.equal(feeAmount)

      const balanceRewardAddress1 = await blockRewardContract.validatorRewardList(0)
      const balanceRewardAddress2 = await blockRewardContract.validatorRewardList(1)
      const balanceRewardAddress3 = await blockRewardContract.validatorRewardList(2)

      expect(balanceRewardAddress1.eq(feePerValidator) || balanceRewardAddress1.eq(feePerValidatorPlusDiff)).to.equal(
        true
      )
      expect(balanceRewardAddress2.eq(feePerValidator) || balanceRewardAddress2.eq(feePerValidatorPlusDiff)).to.equal(
        true
      )
      expect(balanceRewardAddress3.eq(feePerValidator) || balanceRewardAddress3.eq(feePerValidatorPlusDiff)).to.equal(
        true
      )
    })
    it('should distribute fee to 5 validators', async () => {
      // Given
      const recipient = accounts[0]
      const owner = accounts[0]
      const validators = [accounts[0], accounts[1], accounts[2], accounts[3], accounts[4]]
      const rewards = [accounts[5], accounts[6], accounts[7], accounts[8], accounts[9]]
      const requiredSignatures = 3
      await rewardableValidators.initialize(requiredSignatures, validators, rewards, owner).should.be.fulfilled
      await blockRewardContract.setValidatorsRewards(rewards)
      await blockRewardContract.setToken(token.address)
      await token.setBlockRewardContract(blockRewardContract.address)
      await token.transferOwnership(homeBridge.address)

      const valueCalc = 0.5 * (1 - fee)
      const value = ether(valueCalc.toString())
      const feeAmountCalc = 0.5 * fee
      const feeAmount = ether(feeAmountCalc.toString())
      const feePerValidator = feeAmount.div(toBN(5))
      const transactionHash = '0x1045bfe274b88120a6b1e5d01b5ec00ab5d01098346e90e7c7a3c9b8f0181c80'
      const message = createMessage(recipient, value, transactionHash, homeBridge.address)
      const signature = await sign(validators[0], message)
      const signature2 = await sign(validators[1], message)
      const signature3 = await sign(validators[2], message)

      // When
      await homeBridge.submitSignature(signature, message, { from: validators[0] }).should.be.fulfilled
      await homeBridge.submitSignature(signature2, message, { from: validators[1] }).should.be.fulfilled
      const { logs } = await homeBridge.submitSignature(signature3, message, {
        from: validators[2]
      }).should.be.fulfilled

      // Then
      logs.length.should.be.equal(3)
      logs[1].event.should.be.equal('CollectedSignatures')
      expectEventInLogs(logs, 'FeeDistributedFromSignatures', {
        feeAmount,
        transactionHash
      })

      const finalBridgeBalance = await token.balanceOf(homeBridge.address)
      finalBridgeBalance.should.be.bignumber.equal('0')

      const feeDistributed = await blockRewardContract.feeAmount()
      feeDistributed.should.be.bignumber.equal(feeAmount)

      const balanceRewardAddress1 = await blockRewardContract.validatorRewardList(0)
      const balanceRewardAddress2 = await blockRewardContract.validatorRewardList(1)
      const balanceRewardAddress3 = await blockRewardContract.validatorRewardList(2)
      const balanceRewardAddress4 = await blockRewardContract.validatorRewardList(3)
      const balanceRewardAddress5 = await blockRewardContract.validatorRewardList(4)

      balanceRewardAddress1.should.be.bignumber.equal(feePerValidator)
      balanceRewardAddress2.should.be.bignumber.equal(feePerValidator)
      balanceRewardAddress3.should.be.bignumber.equal(feePerValidator)
      balanceRewardAddress4.should.be.bignumber.equal(feePerValidator)
      balanceRewardAddress5.should.be.bignumber.equal(feePerValidator)
    })
    it('should distribute fee to max allowed number of validator', async () => {
      // Given
      const recipient = accounts[9]
      const owner = accounts[0]
      const validators = createAccounts(web3, MAX_VALIDATORS)
      validators[0] = accounts[2]
      const rewards = createAccounts(web3, MAX_VALIDATORS)
      const requiredSignatures = 1
      await rewardableValidators.initialize(requiredSignatures, validators, rewards, owner).should.be.fulfilled
      await blockRewardContract.setValidatorsRewards(rewards)
      await blockRewardContract.setToken(token.address)
      await token.setBlockRewardContract(blockRewardContract.address, { from: owner })
      await token.transferOwnership(homeBridge.address, { from: owner })

      const valueCalc = 0.5 * (1 - fee)
      const value = ether(valueCalc.toString())
      const transactionHash = '0x1045bfe274b88120a6b1e5d01b5ec00ab5d01098346e90e7c7a3c9b8f0181c80'
      const message = createMessage(recipient, value, transactionHash, homeBridge.address)
      const signature = await sign(validators[0], message)

      const blockRewardBalanceBefore = await token.balanceOf(blockRewardContract.address)
      blockRewardBalanceBefore.should.be.bignumber.equal('0')

      // When
      const { receipt } = await homeBridge.submitSignature(signature, message, {
        from: validators[0]
      }).should.be.fulfilled
      expect(receipt.gasUsed).to.be.lte(MAX_GAS)
    })
  })
  describe('#rewardable_executeAffirmation', () => {
    let fee
    let homeFee
    let foreignFee
    let homeBridge
    let rewardableValidators
    let blockRewardContract
    let feeManager
    beforeEach(async () => {
      token = await ERC677BridgeTokenRewardable.new('Some ERC20', 'RSZT', 18, 100)
      rewardableValidators = await RewardableValidators.new()
      feeManager = await FeeManagerErcToErcPOSDAO.new()
      homeBridge = await POSDAOHomeBridge.new()
      fee = 0.001
      homeFee = ether(fee.toString())
      foreignFee = ether(fee.toString())
      blockRewardContract = await BlockReward.new()
      await homeBridge.rewardableInitialize(
        rewardableValidators.address,
        [oneEther, halfEther, minPerTx],
        gasPrice,
        requireBlockConfirmations,
        token.address,
        [foreignDailyLimit, foreignMaxPerTx],
        owner,
        feeManager.address,
        [homeFee, foreignFee],
        blockRewardContract.address,
        decimalShiftZero
      ).should.be.fulfilled
    })
    it('should distribute fee to one validator', async () => {
      // Given
      const recipient = accounts[9]
      const owner = accounts[0]
      const validators = [accounts[1]]
      const rewards = [accounts[2]]
      const requiredSignatures = 1
      await rewardableValidators.initialize(requiredSignatures, validators, rewards, owner).should.be.fulfilled
      await blockRewardContract.setValidatorsRewards(rewards)
      await blockRewardContract.setToken(token.address)
      await token.setBlockRewardContract(blockRewardContract.address)
      await token.transferOwnership(homeBridge.address)

      const initialValue = halfEther
      const valueCalc = 0.5 * (1 - fee)
      const value = ether(valueCalc.toString())
      const feeAmountCalc = 0.5 * fee
      const feeAmount = ether(feeAmountCalc.toString())
      const transactionHash = '0x1045bfe274b88120a6b1e5d01b5ec00ab5d01098346e90e7c7a3c9b8f0181c80'

      const rewardAddressBalanceBefore = await token.balanceOf(rewards[0])
      rewardAddressBalanceBefore.should.be.bignumber.equal('0')

      // When
      const { logs } = await homeBridge.executeAffirmation(recipient, initialValue, transactionHash, {
        from: validators[0]
      }).should.be.fulfilled

      // Then
      expectEventInLogs(logs, 'FeeDistributedFromAffirmation', {
        feeAmount,
        transactionHash
      })

      expectEventInLogs(logs, 'AffirmationCompleted', {
        recipient,
        value: initialValue,
        transactionHash
      })

      const feeDistributed = await blockRewardContract.feeAmount()
      feeDistributed.should.be.bignumber.equal(feeAmount)

      const rewardAddressBalanceAfter = await blockRewardContract.validatorRewardList(0)
      rewardAddressBalanceAfter.should.be.bignumber.equal(feeAmount)

      const recipientBalance = await token.balanceOf(recipient)
      recipientBalance.should.be.bignumber.equal(value)
    })
    it('should distribute fee to 3 validators', async () => {
      // Given
      const recipient = accounts[8]
      const owner = accounts[9]
      const validators = [accounts[1], accounts[2], accounts[3]]
      const rewards = [accounts[4], accounts[5], accounts[6]]
      const requiredSignatures = 2
      await rewardableValidators.initialize(requiredSignatures, validators, rewards, owner).should.be.fulfilled
      await blockRewardContract.setValidatorsRewards(rewards)
      await blockRewardContract.setToken(token.address)
      await token.setBlockRewardContract(blockRewardContract.address)
      await token.transferOwnership(homeBridge.address)

      const initialValue = halfEther
      const valueCalc = 0.5 * (1 - fee)
      const value = ether(valueCalc.toString())
      const feeAmountCalc = 0.5 * fee
      const feeAmount = ether(feeAmountCalc.toString())
      const feePerValidator = toBN(166666666666666)
      const feePerValidatorPlusDiff = toBN(166666666666668)
      const transactionHash = '0x1045bfe274b88120a6b1e5d01b5ec00ab5d01098346e90e7c7a3c9b8f0181c80'

      const rewardAddressBalanceBefore = await token.balanceOf(rewards[0])
      rewardAddressBalanceBefore.should.be.bignumber.equal('0')

      // When
      await homeBridge.executeAffirmation(recipient, initialValue, transactionHash, {
        from: validators[0]
      }).should.be.fulfilled
      const { logs } = await homeBridge.executeAffirmation(recipient, initialValue, transactionHash, {
        from: validators[1]
      }).should.be.fulfilled

      // Then
      expectEventInLogs(logs, 'FeeDistributedFromAffirmation', {
        feeAmount,
        transactionHash
      })

      expectEventInLogs(logs, 'AffirmationCompleted', {
        recipient,
        value: initialValue,
        transactionHash
      })

      const feeDistributed = await blockRewardContract.feeAmount()
      feeDistributed.should.be.bignumber.equal(feeAmount)

      const recipientBalance = await token.balanceOf(recipient)
      recipientBalance.should.be.bignumber.equal(value)

      const balanceRewardAddress1 = await blockRewardContract.validatorRewardList(0)
      const balanceRewardAddress2 = await blockRewardContract.validatorRewardList(1)
      const balanceRewardAddress3 = await blockRewardContract.validatorRewardList(2)

      expect(balanceRewardAddress1.eq(feePerValidator) || balanceRewardAddress1.eq(feePerValidatorPlusDiff)).to.equal(
        true
      )
      expect(balanceRewardAddress2.eq(feePerValidator) || balanceRewardAddress2.eq(feePerValidatorPlusDiff)).to.equal(
        true
      )
      expect(balanceRewardAddress3.eq(feePerValidator) || balanceRewardAddress3.eq(feePerValidatorPlusDiff)).to.equal(
        true
      )
    })
    it('should distribute fee to 5 validators', async () => {
      // Given
      const recipient = accounts[0]
      const owner = accounts[0]
      const validators = [accounts[0], accounts[1], accounts[2], accounts[3], accounts[4]]
      const rewards = [accounts[5], accounts[6], accounts[7], accounts[8], accounts[9]]
      const requiredSignatures = 3
      await rewardableValidators.initialize(requiredSignatures, validators, rewards, owner).should.be.fulfilled
      await blockRewardContract.setValidatorsRewards(rewards)
      await blockRewardContract.setToken(token.address)
      await token.setBlockRewardContract(blockRewardContract.address)
      await token.transferOwnership(homeBridge.address)

      const initialValue = halfEther
      const valueCalc = 0.5 * (1 - fee)
      const value = ether(valueCalc.toString())
      const feeAmountCalc = 0.5 * fee
      const feeAmount = ether(feeAmountCalc.toString())
      const feePerValidator = feeAmount.div(toBN(5))
      const transactionHash = '0x1045bfe274b88120a6b1e5d01b5ec00ab5d01098346e90e7c7a3c9b8f0181c80'

      const rewardAddressBalanceBefore = await token.balanceOf(rewards[0])
      rewardAddressBalanceBefore.should.be.bignumber.equal('0')

      // When
      await homeBridge.executeAffirmation(recipient, initialValue, transactionHash, {
        from: validators[0]
      }).should.be.fulfilled
      await homeBridge.executeAffirmation(recipient, initialValue, transactionHash, {
        from: validators[1]
      }).should.be.fulfilled
      const { logs } = await homeBridge.executeAffirmation(recipient, initialValue, transactionHash, {
        from: validators[2]
      }).should.be.fulfilled

      // Then
      expectEventInLogs(logs, 'FeeDistributedFromAffirmation', {
        feeAmount,
        transactionHash
      })

      expectEventInLogs(logs, 'AffirmationCompleted', {
        recipient,
        value: initialValue,
        transactionHash
      })

      const feeDistributed = await blockRewardContract.feeAmount()
      feeDistributed.should.be.bignumber.equal(feeAmount)

      const recipientBalance = await token.balanceOf(recipient)
      recipientBalance.should.be.bignumber.equal(value)

      const balanceRewardAddress1 = await blockRewardContract.validatorRewardList(0)
      const balanceRewardAddress2 = await blockRewardContract.validatorRewardList(1)
      const balanceRewardAddress3 = await blockRewardContract.validatorRewardList(2)
      const balanceRewardAddress4 = await blockRewardContract.validatorRewardList(3)
      const balanceRewardAddress5 = await blockRewardContract.validatorRewardList(4)

      balanceRewardAddress1.should.be.bignumber.equal(feePerValidator)
      balanceRewardAddress2.should.be.bignumber.equal(feePerValidator)
      balanceRewardAddress3.should.be.bignumber.equal(feePerValidator)
      balanceRewardAddress4.should.be.bignumber.equal(feePerValidator)
      balanceRewardAddress5.should.be.bignumber.equal(feePerValidator)
    })

    it('should distribute fee to max allowed number of validators', async () => {
      // Given
      const recipient = accounts[0]
      const owner = accounts[0]
      const validators = createAccounts(web3, MAX_VALIDATORS)
      validators[0] = accounts[2]
      const rewards = createAccounts(web3, MAX_VALIDATORS)
      const requiredSignatures = 1
      await rewardableValidators.initialize(requiredSignatures, validators, rewards, owner, {
        from: owner
      }).should.be.fulfilled
      await blockRewardContract.setValidatorsRewards(rewards)
      await blockRewardContract.setToken(token.address)
      await token.setBlockRewardContract(blockRewardContract.address)
      await token.transferOwnership(homeBridge.address)

      const initialValue = halfEther
      const transactionHash = '0x1045bfe274b88120a6b1e5d01b5ec00ab5d01098346e90e7c7a3c9b8f0181c80'

      // When
      const { receipt } = await homeBridge.executeAffirmation(recipient, initialValue, transactionHash, {
        from: validators[0]
      }).should.be.fulfilled
      expect(receipt.gasUsed).to.be.lte(MAX_GAS)
    })
  })
  describe('#decimals Shift', async () => {
    for (const decimalShift of [2, -1]) {
      it(`Foreign to Home: works with 5 validators and 3 required signatures with decimal shift ${decimalShift}`, async () => {
        const recipient = accounts[8]
        const authoritiesFiveAccs = [accounts[1], accounts[2], accounts[3], accounts[4], accounts[5]]
        const ownerOfValidators = accounts[0]
        const validatorContractWith3Signatures = await BridgeValidators.new()
        await validatorContractWith3Signatures.initialize(3, authoritiesFiveAccs, ownerOfValidators)
        const token = await ERC677BridgeToken.new('Some ERC20', 'RSZT', 16)

        const homeBridgeWithThreeSigs = await HomeBridge.new()
        await homeBridgeWithThreeSigs.initialize(
          validatorContractWith3Signatures.address,
          [oneEther, halfEther, minPerTx],
          gasPrice,
          requireBlockConfirmations,
          token.address,
          [foreignDailyLimit, foreignMaxPerTx],
          owner,
          decimalShift
        )
        await token.transferOwnership(homeBridgeWithThreeSigs.address)

        const valueOnForeign = toBN('1000')
        // Value is decimals shifted from foreign to home: Native on home = 16+2 shift = 18 decimals
        const valueOnHome = toBN(valueOnForeign * 10 ** decimalShift)
        const balanceBeforeRecipient = await token.balanceOf(recipient)
        const transactionHash = '0x806335163828a8eda675cff9c84fa6e6c7cf06bb44cc6ec832e42fe789d01415'

        const { logs } = await homeBridgeWithThreeSigs.executeAffirmation(recipient, valueOnForeign, transactionHash, {
          from: authoritiesFiveAccs[0]
        }).should.be.fulfilled
        expectEventInLogs(logs, 'SignedForAffirmation', {
          signer: authorities[0],
          transactionHash
        })

        await homeBridgeWithThreeSigs.executeAffirmation(recipient, valueOnForeign, transactionHash, {
          from: authoritiesFiveAccs[1]
        }).should.be.fulfilled
        const thirdSignature = await homeBridgeWithThreeSigs.executeAffirmation(
          recipient,
          valueOnForeign,
          transactionHash,
          { from: authoritiesFiveAccs[2] }
        ).should.be.fulfilled

        expectEventInLogs(thirdSignature.logs, 'AffirmationCompleted', {
          recipient,
          value: valueOnForeign,
          transactionHash
        })
        const balanceAfterRecipient = await token.balanceOf(recipient)
        balanceAfterRecipient.should.be.bignumber.equal(balanceBeforeRecipient.add(valueOnHome))
      })
      it(`Foreign to Home: test decimal shift ${decimalShift}, no impact on UserRequestForSignature value`, async () => {
        // Given
        const homeBridge = await HomeBridge.new()
        token = await ERC677BridgeToken.new('Some ERC20', 'TEST', 16)
        const owner = accounts[0]
        const user = accounts[4]
        await homeBridge.initialize(
          validatorContract.address,
          [oneEther, halfEther, minPerTx],
          gasPrice,
          requireBlockConfirmations,
          token.address,
          [foreignDailyLimit, foreignMaxPerTx],
          owner,
          decimalShift
        ).should.be.fulfilled
        const value = halfEther
        await token.mint(user, value, { from: owner }).should.be.fulfilled

        // When
        await token.transferAndCall(homeBridge.address, value, '0x', { from: user }).should.be.fulfilled

        // Then
        const events = await getEvents(homeBridge, { event: 'UserRequestForSignature' })
        expect(events[0].returnValues.recipient).to.be.equal(user)
        expect(toBN(events[0].returnValues.value)).to.be.bignumber.equal(value)
      })
    }
  })
})
