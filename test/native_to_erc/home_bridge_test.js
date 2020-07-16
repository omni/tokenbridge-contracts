const HomeBridge = artifacts.require('HomeBridgeNativeToErc.sol')
const EternalStorageProxy = artifacts.require('EternalStorageProxy.sol')
const BridgeValidators = artifacts.require('BridgeValidators.sol')
const RevertFallback = artifacts.require('RevertFallback.sol')
const FeeManagerNativeToErc = artifacts.require('FeeManagerNativeToErc.sol')
const FeeManagerNativeToErcBothDirections = artifacts.require('FeeManagerNativeToErcBothDirections.sol')
const RewardableValidators = artifacts.require('RewardableValidators.sol')
const ERC677BridgeToken = artifacts.require('ERC677BridgeToken.sol')
const NoReturnTransferTokenMock = artifacts.require('NoReturnTransferTokenMock.sol')

const { expect } = require('chai')
const { ERROR_MSG, ZERO_ADDRESS, toBN } = require('../setup')
const { createMessage, sign, ether, expectEventInLogs, createAccounts } = require('../helpers/helpers')

const minPerTx = ether('0.01')
const requireBlockConfirmations = 8
const gasPrice = web3.utils.toWei('1', 'gwei')
const oneEther = ether('1')
const twoEther = ether('2')
const halfEther = ether('0.5')
const foreignDailyLimit = oneEther
const foreignMaxPerTx = halfEther
const ZERO = toBN(0)
const MAX_GAS = 8000000
const MAX_VALIDATORS = 50
const decimalShiftZero = 0

contract('HomeBridge', async accounts => {
  let homeContract
  let validatorContract
  let authorities
  let owner
  before(async () => {
    validatorContract = await BridgeValidators.new()
    authorities = [accounts[1]]
    owner = accounts[0]
    await validatorContract.initialize(1, authorities, owner)
  })

  describe('#initialize', async () => {
    beforeEach(async () => {
      homeContract = await HomeBridge.new()
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
      expect(await homeContract.gasPrice()).to.be.bignumber.equal(gasPrice)
      expect(await homeContract.decimalShift()).to.be.bignumber.equal('9')
      const bridgeMode = '0x92a8d7fe' // 4 bytes of keccak256('native-to-erc-core')
      expect(await homeContract.getBridgeMode()).to.be.equal(bridgeMode)
      const { major, minor, patch } = await homeContract.getBridgeInterfacesVersion()
      expect(major).to.be.bignumber.gte(ZERO)
      expect(minor).to.be.bignumber.gte(ZERO)
      expect(patch).to.be.bignumber.gte(ZERO)

      expectEventInLogs(logs, 'RequiredBlockConfirmationChanged', {
        requiredBlockConfirmations: toBN(requireBlockConfirmations)
      })
      expectEventInLogs(logs, 'GasPriceChanged', { gasPrice })
      expectEventInLogs(logs, 'ExecutionDailyLimitChanged', { newLimit: foreignDailyLimit })
      expectEventInLogs(logs, 'DailyLimitChanged', { newLimit: '3' })
    })
    it('cant set maxPerTx > dailyLimit', async () => {
      false.should.be.equal(await homeContract.isInitialized())
      await homeContract
        .initialize(
          validatorContract.address,
          ['1', '2', '1'],
          gasPrice,
          requireBlockConfirmations,
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
          [foreignDailyLimit, foreignMaxPerTx],
          owner,
          decimalShiftZero
        )
        .should.be.rejectedWith(ERROR_MSG)
      false.should.be.equal(await homeContract.isInitialized())
    })
    it('can set gas Price ', async () => {
      // Given
      await homeContract.initialize(
        validatorContract.address,
        ['3', '2', '1'],
        gasPrice,
        requireBlockConfirmations,
        [foreignDailyLimit, foreignMaxPerTx],
        owner,
        decimalShiftZero
      ).should.be.fulfilled

      expect(await homeContract.gasPrice()).to.be.bignumber.equal(gasPrice)

      // When
      const newGasPrice = web3.utils.toWei('2', 'gwei')

      await homeContract.setGasPrice(newGasPrice, { from: accounts[2] }).should.be.rejectedWith(ERROR_MSG)
      await homeContract.setGasPrice(0, { from: owner }).should.be.rejectedWith(ERROR_MSG)
      const { logs } = await homeContract.setGasPrice(newGasPrice, { from: owner }).should.be.fulfilled

      // Then
      expect(await homeContract.gasPrice()).to.be.bignumber.equal(newGasPrice)
      expectEventInLogs(logs, 'GasPriceChanged', { gasPrice: newGasPrice })
    })
    it('can set Required Block Confirmations', async () => {
      // Given
      await homeContract.initialize(
        validatorContract.address,
        ['3', '2', '1'],
        gasPrice,
        requireBlockConfirmations,
        [foreignDailyLimit, foreignMaxPerTx],
        owner,
        decimalShiftZero
      ).should.be.fulfilled

      expect(await homeContract.requiredBlockConfirmations()).to.be.bignumber.equal(toBN(requireBlockConfirmations))

      // When
      const newRequiredBlockConfirmations = 15
      await homeContract
        .setRequiredBlockConfirmations(newRequiredBlockConfirmations, { from: accounts[2] })
        .should.be.rejectedWith(ERROR_MSG)
      await homeContract.setRequiredBlockConfirmations(0, { from: owner }).should.be.rejectedWith(ERROR_MSG)
      const { logs } = await homeContract.setRequiredBlockConfirmations(newRequiredBlockConfirmations, { from: owner })
        .should.be.fulfilled

      // Then
      expect(await homeContract.requiredBlockConfirmations()).to.be.bignumber.equal(toBN(newRequiredBlockConfirmations))
      expectEventInLogs(logs, 'RequiredBlockConfirmationChanged', {
        requiredBlockConfirmations: toBN(newRequiredBlockConfirmations)
      })
    })
    it('can be deployed via upgradeToAndCall', async () => {
      const storageProxy = await EternalStorageProxy.new().should.be.fulfilled
      const data = homeContract.contract.methods
        .initialize(
          validatorContract.address,
          ['3', '2', '1'],
          gasPrice,
          requireBlockConfirmations,
          ['3', '2'],
          owner,
          decimalShiftZero
        )
        .encodeABI()
      await storageProxy.upgradeTo('1', accounts[5]).should.be.rejectedWith(ERROR_MSG)
      await storageProxy.upgradeToAndCall('1', accounts[5], data).should.be.rejectedWith(ERROR_MSG)
      await storageProxy.upgradeToAndCall('1', homeContract.address, data).should.be.fulfilled
      const finalContract = await HomeBridge.at(storageProxy.address)

      expect(await finalContract.isInitialized()).to.be.equal(true)
      expect(await finalContract.validatorContract()).to.be.equal(validatorContract.address)
      expect(await finalContract.dailyLimit()).to.be.bignumber.equal('3')
      expect(await finalContract.maxPerTx()).to.be.bignumber.equal('2')
      expect(await finalContract.minPerTx()).to.be.bignumber.equal('1')
    })
    it('cant initialize with invalid arguments', async () => {
      false.should.be.equal(await homeContract.isInitialized())
      await homeContract
        .initialize(
          validatorContract.address,
          ['3', '2', '1'],
          gasPrice,
          0,
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
          [foreignDailyLimit, foreignMaxPerTx],
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
        [foreignDailyLimit, foreignMaxPerTx],
        owner,
        '100'
      ).should.be.rejected

      await homeContract.initialize(
        validatorContract.address,
        ['3', '2', '1'],
        gasPrice,
        requireBlockConfirmations,
        [foreignDailyLimit, foreignMaxPerTx],
        owner,
        decimalShiftZero
      ).should.be.fulfilled
      true.should.be.equal(await homeContract.isInitialized())
    })
    it('can transfer ownership', async () => {
      // Given
      await homeContract.initialize(
        validatorContract.address,
        ['3', '2', '1'],
        gasPrice,
        requireBlockConfirmations,
        [foreignDailyLimit, foreignMaxPerTx],
        owner,
        decimalShiftZero
      ).should.be.fulfilled

      expect(await homeContract.owner()).to.be.equal(owner)

      // When
      const newOwner = accounts[7]

      await homeContract.transferOwnership(newOwner, { from: accounts[2] }).should.be.rejectedWith(ERROR_MSG)
      await homeContract.transferOwnership(ZERO_ADDRESS, { from: owner }).should.be.rejectedWith(ERROR_MSG)
      const { logs } = await homeContract.transferOwnership(newOwner, { from: owner }).should.be.fulfilled

      // Then
      expect(await homeContract.owner()).to.be.equal(newOwner)
      expectEventInLogs(logs, 'OwnershipTransferred', { previousOwner: owner, newOwner })
    })
    it('can transfer proxyOwnership', async () => {
      const storageProxy = await EternalStorageProxy.new().should.be.fulfilled
      const data = homeContract.contract.methods
        .initialize(
          validatorContract.address,
          ['3', '2', '1'],
          gasPrice,
          requireBlockConfirmations,
          ['3', '2'],
          owner,
          decimalShiftZero
        )
        .encodeABI()
      await storageProxy.upgradeToAndCall('1', homeContract.address, data).should.be.fulfilled
      await storageProxy.transferProxyOwnership(owner).should.be.fulfilled

      expect(await storageProxy.version()).to.be.bignumber.equal(toBN('1'))
    })
  })

  describe('#fallback', async () => {
    beforeEach(async () => {
      homeContract = await HomeBridge.new()
      await homeContract.initialize(
        validatorContract.address,
        ['3', '2', '1'],
        gasPrice,
        requireBlockConfirmations,
        [foreignDailyLimit, foreignMaxPerTx],
        owner,
        decimalShiftZero
      )
    })
    it('should accept native coins', async () => {
      const currentDay = await homeContract.getCurrentDay()
      expect(await homeContract.totalSpentPerDay(currentDay)).to.be.bignumber.equal(ZERO)

      const { logs } = await homeContract.sendTransaction({
        from: accounts[1],
        value: 1
      }).should.be.fulfilled
      expect(await homeContract.totalSpentPerDay(currentDay)).to.be.bignumber.equal('1')

      expectEventInLogs(logs, 'UserRequestForSignature', { recipient: accounts[1], value: toBN(1) })

      await homeContract
        .sendTransaction({
          from: accounts[1],
          value: 3
        })
        .should.be.rejectedWith(ERROR_MSG)

      await homeContract.setDailyLimit(4).should.be.fulfilled
      await homeContract.sendTransaction({
        from: accounts[1],
        value: 1
      }).should.be.fulfilled

      expect(await homeContract.totalSpentPerDay(currentDay)).to.be.bignumber.equal('2')
    })

    it('doesnt let you send more than max amount per tx', async () => {
      await homeContract.sendTransaction({
        from: accounts[1],
        value: 1
      }).should.be.fulfilled
      await homeContract
        .sendTransaction({
          from: accounts[1],
          value: 3
        })
        .should.be.rejectedWith(ERROR_MSG)
      await homeContract.setMaxPerTx(100).should.be.rejectedWith(ERROR_MSG)
      await homeContract.setDailyLimit(100).should.be.fulfilled
      await homeContract.setMaxPerTx(99).should.be.fulfilled
      // meets max per tx and daily limit
      await homeContract.sendTransaction({
        from: accounts[1],
        value: 99
      }).should.be.fulfilled
      // above daily limit
      await homeContract
        .sendTransaction({
          from: accounts[1],
          value: 1
        })
        .should.be.rejectedWith(ERROR_MSG)
    })

    it('should not let to deposit less than minPerTx', async () => {
      const newDailyLimit = 100
      const newMaxPerTx = 50
      const newMinPerTx = 20
      await homeContract.setDailyLimit(newDailyLimit).should.be.fulfilled
      await homeContract.setMaxPerTx(newMaxPerTx).should.be.fulfilled
      await homeContract.setMinPerTx(newMinPerTx).should.be.fulfilled

      await homeContract.sendTransaction({
        from: accounts[1],
        value: newMinPerTx
      }).should.be.fulfilled
      await homeContract
        .sendTransaction({
          from: accounts[1],
          value: newMinPerTx - 1
        })
        .should.be.rejectedWith(ERROR_MSG)
    })
  })

  describe('#relayTokens', async () => {
    const user = accounts[1]
    const user2 = accounts[2]
    beforeEach(async () => {
      homeContract = await HomeBridge.new()
      await homeContract.initialize(
        validatorContract.address,
        ['3', '2', '1'],
        gasPrice,
        requireBlockConfirmations,
        [foreignDailyLimit, foreignMaxPerTx],
        owner,
        decimalShiftZero
      )
    })
    it('should accept native coins and alternative receiver', async () => {
      const currentDay = await homeContract.getCurrentDay()
      expect(await homeContract.totalSpentPerDay(currentDay)).to.be.bignumber.equal(ZERO)

      const { logs } = await homeContract.relayTokens(user2, {
        from: user,
        value: 1
      }).should.be.fulfilled
      expect(await homeContract.totalSpentPerDay(currentDay)).to.be.bignumber.equal('1')

      expectEventInLogs(logs, 'UserRequestForSignature', { recipient: user2, value: toBN(1) })

      await homeContract
        .relayTokens(user2, {
          from: user,
          value: 3
        })
        .should.be.rejectedWith(ERROR_MSG)

      await homeContract.setDailyLimit(4).should.be.fulfilled
      await homeContract.relayTokens(user2, {
        from: user,
        value: 1
      }).should.be.fulfilled

      expect(await homeContract.totalSpentPerDay(currentDay)).to.be.bignumber.equal('2')
    })

    it('doesnt let you send more than max amount per tx', async () => {
      await homeContract.relayTokens(user2, {
        from: user,
        value: 1
      }).should.be.fulfilled
      await homeContract
        .relayTokens(user2, {
          from: user,
          value: 3
        })
        .should.be.rejectedWith(ERROR_MSG)
      await homeContract.setMaxPerTx(100).should.be.rejectedWith(ERROR_MSG)
      await homeContract.setDailyLimit(100).should.be.fulfilled
      await homeContract.setMaxPerTx(99).should.be.fulfilled
      // meets max per tx and daily limit
      await homeContract.relayTokens(user2, {
        from: user,
        value: 99
      }).should.be.fulfilled
      // above daily limit
      await homeContract
        .relayTokens(user2, {
          from: user,
          value: 1
        })
        .should.be.rejectedWith(ERROR_MSG)
    })

    it('should not let to deposit less than minPerTx', async () => {
      const newDailyLimit = 100
      const newMaxPerTx = 50
      const newMinPerTx = 20
      await homeContract.setDailyLimit(newDailyLimit).should.be.fulfilled
      await homeContract.setMaxPerTx(newMaxPerTx).should.be.fulfilled
      await homeContract.setMinPerTx(newMinPerTx).should.be.fulfilled

      await homeContract.relayTokens(user2, {
        from: user,
        value: newMinPerTx
      }).should.be.fulfilled
      await homeContract
        .relayTokens(user2, {
          from: user,
          value: newMinPerTx - 1
        })
        .should.be.rejectedWith(ERROR_MSG)
    })
  })

  describe('#setting limits', async () => {
    let homeContract
    beforeEach(async () => {
      homeContract = await HomeBridge.new()
      await homeContract.initialize(
        validatorContract.address,
        ['3', '2', '1'],
        gasPrice,
        requireBlockConfirmations,
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
    it('#setDailyLimit allow to set by owner and should be greater than maxPerTx or zero', async () => {
      await homeContract.setDailyLimit(4, { from: authorities[0] }).should.be.rejectedWith(ERROR_MSG)
      await homeContract.setDailyLimit(2, { from: owner }).should.be.rejectedWith(ERROR_MSG)

      await homeContract.setDailyLimit(4, { from: owner }).should.be.fulfilled
      expect(await homeContract.dailyLimit()).to.be.bignumber.equal('4')

      await homeContract.setDailyLimit(0, { from: owner }).should.be.fulfilled
      expect(await homeContract.dailyLimit()).to.be.bignumber.equal(ZERO)

      await homeContract.setDailyLimit(4, { from: owner }).should.be.fulfilled
      expect(await homeContract.dailyLimit()).to.be.bignumber.equal('4')
    })
  })

  describe('#executeAffirmation', async () => {
    let homeBridge
    beforeEach(async () => {
      homeBridge = await HomeBridge.new()
      await homeBridge.initialize(
        validatorContract.address,
        [twoEther, halfEther, minPerTx],
        gasPrice,
        requireBlockConfirmations,
        [foreignDailyLimit, foreignMaxPerTx],
        owner,
        decimalShiftZero
      )
      await homeBridge.sendTransaction({
        from: accounts[2],
        value: halfEther
      }).should.be.fulfilled
    })
    it('should allow validator to executeAffirmation', async () => {
      const recipient = accounts[5]
      const value = halfEther
      const balanceBefore = toBN(await web3.eth.getBalance(recipient))
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
      const homeBalanceAfter = toBN(await web3.eth.getBalance(homeBridge.address))
      const balanceAfter = toBN(await web3.eth.getBalance(recipient))
      balanceAfter.should.be.bignumber.equal(balanceBefore.add(value))
      homeBalanceAfter.should.be.bignumber.equal(ZERO)

      const msgHash = web3.utils.soliditySha3(recipient, value, transactionHash)
      const senderHash = web3.utils.soliditySha3(authorities[0], msgHash)
      true.should.be.equal(await homeBridge.affirmationsSigned(senderHash))
    })

    it('should allow validator to executeAffirmation with zero value', async () => {
      const recipient = accounts[5]
      const value = ZERO
      const balanceBefore = toBN(await web3.eth.getBalance(recipient))
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

      const balanceAfter = toBN(await web3.eth.getBalance(recipient))
      balanceAfter.should.be.bignumber.equal(balanceBefore.add(value))

      const msgHash = web3.utils.soliditySha3(recipient, value, transactionHash)
      const senderHash = web3.utils.soliditySha3(authorities[0], msgHash)
      true.should.be.equal(await homeBridge.affirmationsSigned(senderHash))
    })

    it('test with 2 signatures required', async () => {
      const validatorContractWith2Signatures = await BridgeValidators.new()
      const authoritiesThreeAccs = [accounts[1], accounts[2], accounts[3]]
      const ownerOfValidators = accounts[0]
      await validatorContractWith2Signatures.initialize(2, authoritiesThreeAccs, ownerOfValidators)
      const homeBridgeWithTwoSigs = await HomeBridge.new()
      await homeBridgeWithTwoSigs.initialize(
        validatorContractWith2Signatures.address,
        [twoEther, halfEther, minPerTx],
        gasPrice,
        requireBlockConfirmations,
        [foreignDailyLimit, foreignMaxPerTx],
        owner,
        decimalShiftZero
      )

      await homeBridgeWithTwoSigs.sendTransaction({
        from: accounts[2],
        value: halfEther
      }).should.be.fulfilled
      const homeBalanceBefore = toBN(await web3.eth.getBalance(homeBridgeWithTwoSigs.address))
      homeBalanceBefore.should.be.bignumber.equal(halfEther)

      const recipient = accounts[5]
      const value = halfEther
      const transactionHash = '0x806335163828a8eda675cff9c84fa6e6c7cf06bb44cc6ec832e42fe789d01415'
      const balanceBefore = toBN(await web3.eth.getBalance(recipient))
      const msgHash = web3.utils.soliditySha3(recipient, value, transactionHash)

      const { logs } = await homeBridgeWithTwoSigs.executeAffirmation(recipient, value, transactionHash, {
        from: authoritiesThreeAccs[0]
      }).should.be.fulfilled

      expectEventInLogs(logs, 'SignedForAffirmation', { signer: authorities[0], transactionHash })
      halfEther.should.be.bignumber.equal(await web3.eth.getBalance(homeBridgeWithTwoSigs.address))
      const notProcessed = await homeBridgeWithTwoSigs.numAffirmationsSigned(msgHash)
      notProcessed.should.be.bignumber.equal('1')

      await homeBridgeWithTwoSigs
        .executeAffirmation(recipient, value, transactionHash, { from: authoritiesThreeAccs[0] })
        .should.be.rejectedWith(ERROR_MSG)
      const secondSignature = await homeBridgeWithTwoSigs.executeAffirmation(recipient, value, transactionHash, {
        from: authoritiesThreeAccs[1]
      }).should.be.fulfilled

      const balanceAfter = toBN(await web3.eth.getBalance(recipient))
      balanceAfter.should.be.bignumber.equal(balanceBefore.add(value))
      expect(toBN(await web3.eth.getBalance(homeBridgeWithTwoSigs.address))).to.be.bignumber.equal(ZERO)

      expectEventInLogs(secondSignature.logs, 'AffirmationCompleted', {
        recipient,
        value,
        transactionHash
      })

      const senderHash = web3.utils.soliditySha3(authoritiesThreeAccs[0], msgHash)
      true.should.be.equal(await homeBridgeWithTwoSigs.affirmationsSigned(senderHash))

      const senderHash2 = web3.utils.soliditySha3(authoritiesThreeAccs[1], msgHash)
      true.should.be.equal(await homeBridgeWithTwoSigs.affirmationsSigned(senderHash2))

      const markedAsProcessed = await homeBridgeWithTwoSigs.numAffirmationsSigned(msgHash)
      const processed = toBN(2)
        .pow(toBN(255))
        .add(toBN(2))
      markedAsProcessed.should.be.bignumber.equal(processed)
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

    it('should not allow non-authorities to execute withdraw', async () => {
      const recipient = accounts[5]
      const value = oneEther
      const transactionHash = '0x806335163828a8eda675cff9c84fa6e6c7cf06bb44cc6ec832e42fe789d01415'
      await homeBridge
        .executeAffirmation(recipient, value, transactionHash, { from: accounts[7] })
        .should.be.rejectedWith(ERROR_MSG)
    })

    it('doesnt allow to withdraw if requiredSignatures has changed', async () => {
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
        [foreignDailyLimit, foreignMaxPerTx],
        owner,
        decimalShiftZero
      )

      await homeBridgeWithTwoSigs.sendTransaction({
        from: accounts[2],
        value: halfEther
      }).should.be.fulfilled
      const homeBalanceBefore = toBN(await web3.eth.getBalance(homeBridgeWithTwoSigs.address))
      homeBalanceBefore.should.be.bignumber.equal(halfEther)

      const recipient = accounts[5]
      const value = halfEther.div(toBN(2))
      const transactionHash = '0x806335163828a8eda675cff9c84fa6e6c7cf06bb44cc6ec832e42fe789d01415'
      const balanceBefore = toBN(await web3.eth.getBalance(recipient))

      await homeBridgeWithTwoSigs.executeAffirmation(recipient, value, transactionHash, {
        from: authoritiesThreeAccs[0]
      }).should.be.fulfilled
      await homeBridgeWithTwoSigs.executeAffirmation(recipient, value, transactionHash, {
        from: authoritiesThreeAccs[1]
      }).should.be.fulfilled
      expect(toBN(await web3.eth.getBalance(recipient))).to.be.bignumber.equal(balanceBefore.add(value))

      await validatorContractWith2Signatures.setRequiredSignatures(3).should.be.fulfilled
      await homeBridgeWithTwoSigs
        .executeAffirmation(recipient, value, transactionHash, { from: authoritiesThreeAccs[2] })
        .should.be.rejectedWith(ERROR_MSG)

      await validatorContractWith2Signatures.setRequiredSignatures(1).should.be.fulfilled
      await homeBridgeWithTwoSigs
        .executeAffirmation(recipient, value, transactionHash, { from: authoritiesThreeAccs[2] })
        .should.be.rejectedWith(ERROR_MSG)
      expect(toBN(await web3.eth.getBalance(recipient))).to.be.bignumber.equal(balanceBefore.add(value))
    })

    it('force withdraw if the recepient has fallback to revert', async () => {
      const revertFallbackContract = await RevertFallback.new()
      await revertFallbackContract.receiveEth({ from: accounts[0], value: halfEther })
      expect(toBN(await web3.eth.getBalance(revertFallbackContract.address))).to.be.bignumber.equal(halfEther)

      const transactionHash = '0x106335163828a8eda675cff9c84fa6e6c7cf06bb44cc6ec832e42fe789d01415'
      const { logs } = await homeBridge.executeAffirmation(revertFallbackContract.address, halfEther, transactionHash, {
        from: authorities[0]
      })

      expectEventInLogs(logs, 'SignedForAffirmation', {
        signer: authorities[0],
        transactionHash
      })
      expectEventInLogs(logs, 'AffirmationCompleted', {
        recipient: revertFallbackContract.address,
        value: halfEther,
        transactionHash
      })
      const homeBalanceAfter = toBN(await web3.eth.getBalance(homeBridge.address))
      const balanceAfter = toBN(await web3.eth.getBalance(revertFallbackContract.address))
      balanceAfter.should.be.bignumber.equal(halfEther.add(halfEther))
      homeBalanceAfter.should.be.bignumber.equal(ZERO)
    })
    it('works with 5 validators and 3 required signatures', async () => {
      const recipient = accounts[8]
      const authoritiesFiveAccs = [accounts[1], accounts[2], accounts[3], accounts[4], accounts[5]]
      const ownerOfValidators = accounts[0]
      const validatorContractWith3Signatures = await BridgeValidators.new()
      await validatorContractWith3Signatures.initialize(3, authoritiesFiveAccs, ownerOfValidators)

      const homeBridgeWithThreeSigs = await HomeBridge.new()
      await homeBridgeWithThreeSigs.initialize(
        validatorContractWith3Signatures.address,
        [oneEther, halfEther, minPerTx],
        gasPrice,
        requireBlockConfirmations,
        [foreignDailyLimit, foreignMaxPerTx],
        owner,
        decimalShiftZero
      )

      const value = halfEther
      const transactionHash = '0x806335163828a8eda675cff9c84fa6e6c7cf06bb44cc6ec832e42fe789d01415'

      await homeBridgeWithThreeSigs.sendTransaction({
        from: recipient,
        value: halfEther
      }).should.be.fulfilled

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

      await homeBridge
        .executeAffirmation(recipient, value, transactionHash, { from: authorities[0] })
        .should.be.rejectedWith(ERROR_MSG)
    })
    it('should not allow execute affirmation over daily foreign limit', async () => {
      await homeBridge.sendTransaction({ from: accounts[2], value: halfEther }).should.be.fulfilled
      await homeBridge.sendTransaction({ from: accounts[2], value: halfEther }).should.be.fulfilled

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
      await homeBridge
        .executeAffirmation(recipient, value, transactionHash3, { from: authorities[0] })
        .should.be.rejectedWith(ERROR_MSG)
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
        [foreignDailyLimit, foreignMaxPerTx],
        owner,
        decimalShiftZero
      )
    })
    it('allows a validator to submit a signature', async () => {
      const recipientAccount = accounts[8]
      const value = halfEther
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
      const hashSenderMsg = web3.utils.soliditySha3(authorities[0], hashMsg)
      true.should.be.equal(await homeBridgeWithTwoSigs.messagesSigned(hashSenderMsg))
    })
    it('when enough requiredSignatures are collected, CollectedSignatures event is emitted', async () => {
      const recipientAccount = accounts[8]
      const value = halfEther
      const transactionHash = '0x1045bfe274b88120a6b1e5d01b5ec00ab5d01098346e90e7c7a3c9b8f0181c80'
      const message = createMessage(recipientAccount, value, transactionHash, homeBridgeWithTwoSigs.address)
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
    })
    it('works with 5 validators and 3 required signatures', async () => {
      const recipientAccount = accounts[8]
      const authoritiesFiveAccs = [accounts[1], accounts[2], accounts[3], accounts[4], accounts[5]]
      const validatorContractWith3Signatures = await BridgeValidators.new()
      await validatorContractWith3Signatures.initialize(3, authoritiesFiveAccs, ownerOfValidators)

      const homeBridgeWithThreeSigs = await HomeBridge.new()
      await homeBridgeWithThreeSigs.initialize(
        validatorContractWith3Signatures.address,
        [oneEther, halfEther, minPerTx],
        gasPrice,
        requireBlockConfirmations,
        [foreignDailyLimit, foreignMaxPerTx],
        owner,
        decimalShiftZero
      )

      const value = halfEther
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
      const value = halfEther
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
      const value = halfEther
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
      expect(await homeContract.requiredMessageLength()).to.be.bignumber.equal('104')
    })
  })

  describe('#claimTokens', () => {
    it('should work with token that return bool on transfer', async () => {
      const storageProxy = await EternalStorageProxy.new()
      const data = homeContract.contract.methods
        .initialize(
          validatorContract.address,
          ['3', '2', '1'],
          gasPrice,
          requireBlockConfirmations,
          ['3', '2'],
          owner,
          decimalShiftZero
        )
        .encodeABI()
      await storageProxy.upgradeToAndCall('1', homeContract.address, data).should.be.fulfilled
      const homeBridge = await HomeBridge.at(storageProxy.address)

      const token = await ERC677BridgeToken.new('Test', 'TST', 18)

      await token.mint(accounts[0], halfEther).should.be.fulfilled
      expect(await token.balanceOf(accounts[0])).to.be.bignumber.equal(halfEther)

      await token.transfer(homeBridge.address, halfEther).should.be.fulfilled
      expect(await token.balanceOf(accounts[0])).to.be.bignumber.equal(ZERO)
      expect(await token.balanceOf(homeBridge.address)).to.be.bignumber.equal(halfEther)

      await homeBridge.claimTokens(token.address, accounts[3], { from: owner }).should.be.fulfilled
      expect(await token.balanceOf(homeBridge.address)).to.be.bignumber.equal(ZERO)
      expect(await token.balanceOf(accounts[3])).to.be.bignumber.equal(halfEther)
    })
    it('should works with token that not return on transfer', async () => {
      const storageProxy = await EternalStorageProxy.new()
      const data = homeContract.contract.methods
        .initialize(
          validatorContract.address,
          ['3', '2', '1'],
          gasPrice,
          requireBlockConfirmations,
          ['3', '2'],
          owner,
          decimalShiftZero
        )
        .encodeABI()
      await storageProxy.upgradeToAndCall('1', homeContract.address, data).should.be.fulfilled
      const homeBridge = await HomeBridge.at(storageProxy.address)

      const tokenMock = await NoReturnTransferTokenMock.new()

      await tokenMock.mint(accounts[0], halfEther).should.be.fulfilled
      expect(await tokenMock.balanceOf(accounts[0])).to.be.bignumber.equal(halfEther)

      await tokenMock.transfer(homeBridge.address, halfEther).should.be.fulfilled
      expect(await tokenMock.balanceOf(accounts[0])).to.be.bignumber.equal(ZERO)
      expect(await tokenMock.balanceOf(homeBridge.address)).to.be.bignumber.equal(halfEther)

      await homeBridge.claimTokens(tokenMock.address, accounts[3], { from: owner }).should.be.fulfilled
      expect(await tokenMock.balanceOf(homeBridge.address)).to.be.bignumber.equal(ZERO)
      expect(await tokenMock.balanceOf(accounts[3])).to.be.bignumber.equal(halfEther)
    })
    it('should work for native coins', async () => {
      const storageProxy = await EternalStorageProxy.new()
      const data = homeContract.contract.methods
        .initialize(
          validatorContract.address,
          [oneEther.toString(), halfEther.toString(), '1'],
          gasPrice,
          requireBlockConfirmations,
          [oneEther.toString(), halfEther.toString()],
          owner,
          decimalShiftZero
        )
        .encodeABI()
      await storageProxy.upgradeToAndCall('1', homeContract.address, data).should.be.fulfilled
      const homeBridge = await HomeBridge.at(storageProxy.address)

      const balanceBefore = toBN(await web3.eth.getBalance(accounts[3]))

      await homeBridge.sendTransaction({ from: accounts[2], value: halfEther }).should.be.fulfilled
      expect(toBN(await web3.eth.getBalance(homeBridge.address))).to.be.bignumber.equal(halfEther)

      await homeBridge.claimTokens(ZERO_ADDRESS, accounts[3], { from: owner }).should.be.fulfilled
      expect(toBN(await web3.eth.getBalance(homeBridge.address))).to.be.bignumber.equal(ZERO)
      expect(toBN(await web3.eth.getBalance(accounts[3]))).to.be.bignumber.equal(balanceBefore.add(halfEther))
    })
  })

  describe('#rewardableInitialize', async () => {
    let homeFee
    let foreignFee
    let homeBridge
    let rewardableValidators
    const validators = [accounts[1]]
    const rewards = [accounts[2]]
    const requiredSignatures = 1
    beforeEach(async () => {
      rewardableValidators = await RewardableValidators.new()
      await rewardableValidators.initialize(requiredSignatures, validators, rewards, owner).should.be.fulfilled
      homeBridge = await HomeBridge.new()
      homeFee = ZERO
      foreignFee = ether('0.002')
    })
    it('sets variables', async () => {
      const feeManager = await FeeManagerNativeToErc.new()
      expect(await homeBridge.validatorContract()).to.be.equal(ZERO_ADDRESS)
      expect(await homeBridge.deployedAtBlock()).to.be.bignumber.equal(ZERO)
      expect(await homeBridge.dailyLimit()).to.be.bignumber.equal(ZERO)
      expect(await homeBridge.maxPerTx()).to.be.bignumber.equal(ZERO)
      expect(await homeBridge.isInitialized()).to.be.equal(false)

      await homeBridge
        .rewardableInitialize(
          ZERO_ADDRESS,
          [oneEther, halfEther, minPerTx],
          gasPrice,
          requireBlockConfirmations,
          [foreignDailyLimit, foreignMaxPerTx],
          owner,
          feeManager.address,
          [homeFee, foreignFee],
          decimalShiftZero
        )
        .should.be.rejectedWith(ERROR_MSG)
      await homeBridge
        .rewardableInitialize(
          rewardableValidators.address,
          [oneEther, halfEther, minPerTx],
          0,
          requireBlockConfirmations,
          [foreignDailyLimit, foreignMaxPerTx],
          owner,
          feeManager.address,
          [homeFee, foreignFee],
          decimalShiftZero
        )
        .should.be.rejectedWith(ERROR_MSG)
      await homeBridge
        .rewardableInitialize(
          rewardableValidators.address,
          [oneEther, halfEther, minPerTx],
          gasPrice,
          0,
          [foreignDailyLimit, foreignMaxPerTx],
          owner,
          feeManager.address,
          [homeFee, foreignFee],
          decimalShiftZero
        )
        .should.be.rejectedWith(ERROR_MSG)
      await homeBridge
        .rewardableInitialize(
          rewardableValidators.address,
          [oneEther, halfEther, minPerTx],
          gasPrice,
          requireBlockConfirmations,
          [foreignDailyLimit, foreignMaxPerTx],
          owner,
          ZERO_ADDRESS,
          [homeFee, foreignFee],
          decimalShiftZero
        )
        .should.be.rejectedWith(ERROR_MSG)
      await homeBridge.rewardableInitialize(
        rewardableValidators.address,
        [oneEther, halfEther, minPerTx],
        gasPrice,
        requireBlockConfirmations,
        [foreignDailyLimit, foreignMaxPerTx],
        owner,
        feeManager.address,
        [homeFee, foreignFee],
        decimalShiftZero
      ).should.be.fulfilled

      expect(await homeBridge.isInitialized()).to.be.equal(true)
      expect(await homeBridge.validatorContract()).to.be.equal(rewardableValidators.address)
      expect(await homeBridge.deployedAtBlock()).to.be.bignumber.above(ZERO)
      expect(await homeBridge.dailyLimit()).to.be.bignumber.equal(oneEther)
      expect(await homeBridge.maxPerTx()).to.be.bignumber.equal(halfEther)
      expect(await homeBridge.minPerTx()).to.be.bignumber.equal(minPerTx)
      expect(await homeBridge.gasPrice()).to.be.bignumber.equal(gasPrice)
      const bridgeMode = '0x92a8d7fe' // 4 bytes of keccak256('native-to-erc-core')
      expect(await homeBridge.getBridgeMode()).to.be.equal(bridgeMode)
      const { major, minor, patch } = await homeBridge.getBridgeInterfacesVersion()
      expect(major).to.be.bignumber.gte(ZERO)
      expect(minor).to.be.bignumber.gte(ZERO)
      expect(patch).to.be.bignumber.gte(ZERO)

      const feeManagerContract = await homeBridge.feeManagerContract()
      feeManagerContract.should.be.equals(feeManager.address)
      const bridgeForeignFee = await homeBridge.getForeignFee()
      bridgeForeignFee.should.be.bignumber.equal(foreignFee)
    })

    it('can update fee contract', async () => {
      const feeManager = await FeeManagerNativeToErc.new()
      await homeBridge.rewardableInitialize(
        rewardableValidators.address,
        [oneEther, halfEther, minPerTx],
        gasPrice,
        requireBlockConfirmations,
        [foreignDailyLimit, foreignMaxPerTx],
        owner,
        feeManager.address,
        [homeFee, foreignFee],
        decimalShiftZero
      ).should.be.fulfilled

      // Given
      const newFeeManager = await FeeManagerNativeToErc.new()

      // When
      await homeBridge.setFeeManagerContract(newFeeManager.address, { from: owner }).should.be.fulfilled

      // Then
      const feeManagerContract = await homeBridge.feeManagerContract()
      feeManagerContract.should.be.equals(newFeeManager.address)
    })

    it('can update fee', async () => {
      const feeManager = await FeeManagerNativeToErc.new()
      await homeBridge.rewardableInitialize(
        rewardableValidators.address,
        [oneEther, halfEther, minPerTx],
        gasPrice,
        requireBlockConfirmations,
        [foreignDailyLimit, foreignMaxPerTx],
        owner,
        feeManager.address,
        [homeFee, foreignFee],
        decimalShiftZero
      ).should.be.fulfilled

      // Given
      const newForeignFee = ether('0.2')

      // When
      await homeBridge.setForeignFee(newForeignFee, { from: owner }).should.be.fulfilled

      // Then
      const bridgeForeignFee = await homeBridge.getForeignFee()
      bridgeForeignFee.should.be.bignumber.equal(newForeignFee)
    })
    it('fee should be less than 100%', async () => {
      const feeManager = await FeeManagerNativeToErc.new()
      await homeBridge.rewardableInitialize(
        rewardableValidators.address,
        [oneEther, halfEther, minPerTx],
        gasPrice,
        requireBlockConfirmations,
        [foreignDailyLimit, foreignMaxPerTx],
        owner,
        feeManager.address,
        [homeFee, foreignFee],
        decimalShiftZero
      ).should.be.fulfilled

      // Given
      const invalidFee = ether('1')
      const invalidBigFee = ether('2')
      const newForeignFee = ether('0.99')

      // When
      await homeBridge.setForeignFee(invalidFee, { from: owner }).should.be.rejectedWith(ERROR_MSG)
      await homeBridge.setForeignFee(invalidBigFee, { from: owner }).should.be.rejectedWith(ERROR_MSG)
      await homeBridge.setForeignFee(newForeignFee, { from: owner }).should.be.fulfilled

      // Then
      expect(await homeBridge.getForeignFee()).to.be.bignumber.equals(newForeignFee)
    })
    it('should be able to get fee manager mode', async () => {
      // Given
      const feeManager = await FeeManagerNativeToErc.new()
      const oneDirectionsModeHash = '0xf2aed8f7'

      // When
      await homeBridge.rewardableInitialize(
        rewardableValidators.address,
        [oneEther, halfEther, minPerTx],
        gasPrice,
        requireBlockConfirmations,
        [foreignDailyLimit, foreignMaxPerTx],
        owner,
        feeManager.address,
        [homeFee, foreignFee],
        decimalShiftZero
      ).should.be.fulfilled

      // Then
      const feeManagerMode = await homeBridge.getFeeManagerMode()
      feeManagerMode.should.be.equals(oneDirectionsModeHash)
    })
    it('should be able to get fee manager mode for both directions', async () => {
      // Given
      const feeManager = await FeeManagerNativeToErcBothDirections.new()
      const bothDirectionsModeHash = '0xd7de965f'

      // When
      await homeBridge.rewardableInitialize(
        rewardableValidators.address,
        [oneEther, halfEther, minPerTx],
        gasPrice,
        requireBlockConfirmations,
        [foreignDailyLimit, foreignMaxPerTx],
        owner,
        feeManager.address,
        [homeFee, foreignFee],
        decimalShiftZero
      ).should.be.fulfilled

      // Then
      const feeManagerMode = await homeBridge.getFeeManagerMode()
      feeManagerMode.should.be.equals(bothDirectionsModeHash)
    })
  })

  describe('#feeManager_OneDirection_fallback', () => {
    it('should not subtract fee from value', async () => {
      // Initialize
      const user = accounts[0]
      const owner = accounts[9]
      const validators = [accounts[1]]
      const rewards = [accounts[2]]
      const requiredSignatures = 1
      const rewardableValidators = await RewardableValidators.new()
      const homeBridge = await HomeBridge.new()
      await rewardableValidators.initialize(requiredSignatures, validators, rewards, owner, {
        from: owner
      }).should.be.fulfilled
      const feeManager = await FeeManagerNativeToErc.new()

      // Given
      // 0.1% fee
      const fee = 0.001
      const feeInWei = ether(fee.toString())
      const notUsedFee = ZERO
      const value = halfEther

      await homeBridge.rewardableInitialize(
        rewardableValidators.address,
        [oneEther, halfEther, minPerTx],
        gasPrice,
        requireBlockConfirmations,
        [foreignDailyLimit, foreignMaxPerTx],
        owner,
        feeManager.address,
        [notUsedFee, feeInWei],
        decimalShiftZero
      ).should.be.fulfilled

      // When
      const { logs } = await homeBridge.sendTransaction({
        from: user,
        value
      }).should.be.fulfilled

      // Then
      expectEventInLogs(logs, 'UserRequestForSignature', {
        recipient: user,
        value
      })
    })
  })

  describe('#feeManager_OneDirection_relayRequest', () => {
    it('should not subtract fee from value', async () => {
      // Initialize
      const user = accounts[0]
      const user2 = accounts[4]
      const owner = accounts[9]
      const validators = [accounts[1]]
      const rewards = [accounts[2]]
      const requiredSignatures = 1
      const rewardableValidators = await RewardableValidators.new()
      const homeBridge = await HomeBridge.new()
      await rewardableValidators.initialize(requiredSignatures, validators, rewards, owner, {
        from: owner
      }).should.be.fulfilled
      const feeManager = await FeeManagerNativeToErc.new()

      // Given
      // 0.1% fee
      const fee = 0.001
      const feeInWei = ether(fee.toString())
      const notUsedFee = ZERO
      const value = halfEther

      await homeBridge.rewardableInitialize(
        rewardableValidators.address,
        [oneEther, halfEther, minPerTx],
        gasPrice,
        requireBlockConfirmations,
        [foreignDailyLimit, foreignMaxPerTx],
        owner,
        feeManager.address,
        [notUsedFee, feeInWei],
        decimalShiftZero
      ).should.be.fulfilled

      // When
      const { logs } = await homeBridge.relayTokens(user2, {
        from: user,
        value
      }).should.be.fulfilled

      // Then
      expectEventInLogs(logs, 'UserRequestForSignature', {
        recipient: user2,
        value
      })
    })
  })

  describe('#feeManager_OneDirection_submitSignature', () => {
    it('should not distribute fee to validator', async () => {
      // Initialize
      const user = accounts[0]
      const owner = accounts[9]
      const validators = [accounts[1]]
      const rewards = [accounts[2]]
      const requiredSignatures = 1
      const rewardableValidators = await RewardableValidators.new()
      const homeBridge = await HomeBridge.new()
      await rewardableValidators.initialize(requiredSignatures, validators, rewards, owner, {
        from: owner
      }).should.be.fulfilled
      const feeManager = await FeeManagerNativeToErc.new()

      // Given
      // 0.1% fee
      const fee = 0.001
      const feeInWei = ether(fee.toString())
      const notUsedFee = ZERO
      const value = halfEther

      const rewardAddressBalanceBefore = await web3.eth.getBalance(rewards[0])

      await homeBridge.rewardableInitialize(
        rewardableValidators.address,
        [oneEther, halfEther, minPerTx],
        gasPrice,
        requireBlockConfirmations,
        [foreignDailyLimit, foreignMaxPerTx],
        owner,
        feeManager.address,
        [notUsedFee, feeInWei],
        decimalShiftZero
      ).should.be.fulfilled

      await homeBridge.sendTransaction({
        from: user,
        value
      }).should.be.fulfilled

      // When
      const transactionHash = '0x1045bfe274b88120a6b1e5d01b5ec00ab5d01098346e90e7c7a3c9b8f0181c80'
      const message = createMessage(user, value, transactionHash, homeBridge.address)
      const signature = await sign(validators[0], message)
      const { logs } = await homeBridge.submitSignature(signature, message, { from: validators[0] }).should.be.fulfilled

      // Then
      logs.length.should.be.equal(2)
      logs[1].event.should.be.equal('CollectedSignatures')

      const bridgeBalance = toBN(await web3.eth.getBalance(homeBridge.address))
      bridgeBalance.should.be.bignumber.equal(value)

      const rewardAddressBalanceAfter = toBN(await web3.eth.getBalance(rewards[0]))
      rewardAddressBalanceAfter.should.be.bignumber.equal(rewardAddressBalanceBefore)
    })
  })

  describe('#feeManager_OneDirection_ExecuteAffirmation', async () => {
    it('should distribute fee to validator', async () => {
      // Initialize
      const owner = accounts[9]
      const validators = [accounts[1]]
      const rewards = [accounts[2]]
      const requiredSignatures = 1
      const rewardableValidators = await RewardableValidators.new()
      const homeBridge = await HomeBridge.new()
      await rewardableValidators.initialize(requiredSignatures, validators, rewards, owner, {
        from: owner
      }).should.be.fulfilled
      const feeManager = await FeeManagerNativeToErc.new()

      // Given
      // 0.1% fee
      const fee = 0.001
      const feeInWei = ether(fee.toString())
      const notUsedFee = ZERO
      const value = halfEther
      const valueCalc = 0.5 * (1 - fee)
      const finalUserValue = ether(valueCalc.toString())
      const feeAmountCalc = 0.5 * fee
      const feeAmount = ether(feeAmountCalc.toString())

      await homeBridge.rewardableInitialize(
        rewardableValidators.address,
        [oneEther, halfEther, minPerTx],
        gasPrice,
        requireBlockConfirmations,
        [foreignDailyLimit, foreignMaxPerTx],
        owner,
        feeManager.address,
        [notUsedFee, feeInWei],
        decimalShiftZero
      ).should.be.fulfilled
      await homeBridge.sendTransaction({
        from: accounts[0],
        value: halfEther
      }).should.be.fulfilled

      const recipient = accounts[5]
      const balanceBefore = toBN(await web3.eth.getBalance(recipient))
      const rewardAddressBalanceBefore = toBN(await web3.eth.getBalance(rewards[0]))
      const transactionHash = '0x806335163828a8eda675cff9c84fa6e6c7cf06bb44cc6ec832e42fe789d01415'

      // When
      const { logs } = await homeBridge.executeAffirmation(recipient, value, transactionHash, {
        from: validators[0]
      }).should.be.fulfilled

      // Then
      expectEventInLogs(logs, 'SignedForAffirmation', {
        signer: validators[0],
        transactionHash
      })
      expectEventInLogs(logs, 'FeeDistributedFromAffirmation', {
        feeAmount,
        transactionHash
      })
      expectEventInLogs(logs, 'AffirmationCompleted', {
        recipient,
        value,
        transactionHash
      })

      const balanceAfter = toBN(await web3.eth.getBalance(recipient))
      const rewardAddressBalanceAfter = toBN(await web3.eth.getBalance(rewards[0]))

      rewardAddressBalanceAfter.should.be.bignumber.equal(rewardAddressBalanceBefore.add(feeAmount))
      balanceAfter.should.be.bignumber.equal(balanceBefore.add(finalUserValue))
    })
    it('should distribute fee to 3 validators', async () => {
      // Given
      const owner = accounts[9]
      const validators = [accounts[1], accounts[2], accounts[3]]
      const rewards = [accounts[4], accounts[5], accounts[6]]
      const requiredSignatures = 2
      const rewardableValidators = await RewardableValidators.new()

      const value = halfEther
      // 0.1% fee
      const fee = 0.001
      const feeInWei = ether(fee.toString())
      const notUsedFee = ZERO
      const feePerValidator = toBN(166666666666666)
      const feePerValidatorPlusDiff = toBN(166666666666668)
      const valueCalc = 0.5 * (1 - fee)
      const finalUserValue = ether(valueCalc.toString())
      const feeAmountCalc = 0.5 * fee
      const feeAmount = ether(feeAmountCalc.toString())

      const homeBridge = await HomeBridge.new()
      const feeManager = await FeeManagerNativeToErc.new()
      await rewardableValidators.initialize(requiredSignatures, validators, rewards, owner, {
        from: owner
      }).should.be.fulfilled
      await homeBridge.rewardableInitialize(
        rewardableValidators.address,
        [oneEther, halfEther, minPerTx],
        gasPrice,
        requireBlockConfirmations,
        [foreignDailyLimit, foreignMaxPerTx],
        owner,
        feeManager.address,
        [notUsedFee, feeInWei],
        decimalShiftZero
      ).should.be.fulfilled
      await homeBridge.sendTransaction({
        from: accounts[0],
        value: halfEther
      }).should.be.fulfilled

      const recipient = accounts[8]
      const balanceBefore = toBN(await web3.eth.getBalance(recipient))

      const initialBalanceRewardAddress1 = toBN(await web3.eth.getBalance(rewards[0]))
      const initialBalanceRewardAddress2 = toBN(await web3.eth.getBalance(rewards[1]))
      const initialBalanceRewardAddress3 = toBN(await web3.eth.getBalance(rewards[2]))

      const transactionHash = '0x806335163828a8eda675cff9c84fa6e6c7cf06bb44cc6ec832e42fe789d01415'

      // When
      const { logs: logsValidator1 } = await homeBridge.executeAffirmation(recipient, value, transactionHash, {
        from: validators[0]
      }).should.be.fulfilled
      const { logs } = await homeBridge.executeAffirmation(recipient, value, transactionHash, {
        from: validators[1]
      }).should.be.fulfilled

      // Then
      logsValidator1.length.should.be.equals(1)

      expectEventInLogs(logs, 'SignedForAffirmation', {
        signer: validators[1],
        transactionHash
      })
      expectEventInLogs(logs, 'FeeDistributedFromAffirmation', {
        feeAmount,
        transactionHash
      })
      expectEventInLogs(logs, 'AffirmationCompleted', {
        recipient,
        value,
        transactionHash
      })

      const balanceAfter = toBN(await web3.eth.getBalance(recipient))
      balanceAfter.should.be.bignumber.equal(balanceBefore.add(finalUserValue))

      const updatedBalanceRewardAddress1 = toBN(await web3.eth.getBalance(rewards[0]))
      const updatedBalanceRewardAddress2 = toBN(await web3.eth.getBalance(rewards[1]))
      const updatedBalanceRewardAddress3 = toBN(await web3.eth.getBalance(rewards[2]))

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

      const homeBridgeBalance = toBN(await web3.eth.getBalance(homeBridge.address))
      homeBridgeBalance.should.be.bignumber.equal(ZERO)
    })
    it('should distribute fee to 5 validators', async () => {
      // Given
      const owner = accounts[0]
      const validators = [accounts[0], accounts[1], accounts[2], accounts[3], accounts[4]]
      const rewards = [accounts[5], accounts[6], accounts[7], accounts[8], accounts[9]]
      const requiredSignatures = 5

      const value = halfEther
      // 0.1% fee
      const fee = 0.001
      const feeInWei = ether(fee.toString())
      const notUsedFee = ZERO
      const feeAmountCalc = 0.5 * fee
      const feeAmount = ether(feeAmountCalc.toString())
      const feePerValidator = feeAmount.div(toBN(5))

      const rewardableValidators = await RewardableValidators.new()
      const homeBridge = await HomeBridge.new()
      const feeManager = await FeeManagerNativeToErc.new()
      await rewardableValidators.initialize(requiredSignatures, validators, rewards, owner, {
        from: owner
      }).should.be.fulfilled
      await homeBridge.rewardableInitialize(
        rewardableValidators.address,
        [oneEther, halfEther, minPerTx],
        gasPrice,
        requireBlockConfirmations,
        [foreignDailyLimit, foreignMaxPerTx],
        owner,
        feeManager.address,
        [notUsedFee, feeInWei],
        decimalShiftZero
      ).should.be.fulfilled
      await homeBridge.sendTransaction({
        from: accounts[0],
        value: halfEther
      }).should.be.fulfilled

      const recipient = '0xf4BEF13F9f4f2B203FAF0C3cBbaAbe1afE056955'
      const balanceBefore = toBN(await web3.eth.getBalance(recipient))

      const initialBalanceRewardAddress1 = toBN(await web3.eth.getBalance(rewards[0]))
      const initialBalanceRewardAddress2 = toBN(await web3.eth.getBalance(rewards[1]))
      const initialBalanceRewardAddress3 = toBN(await web3.eth.getBalance(rewards[2]))
      const initialBalanceRewardAddress4 = toBN(await web3.eth.getBalance(rewards[3]))
      const initialBalanceRewardAddress5 = toBN(await web3.eth.getBalance(rewards[4]))

      const transactionHash = '0x806335163828a8eda675cff9c84fa6e6c7cf06bb44cc6ec832e42fe789d01415'

      // When
      const { logs: logsValidator1 } = await homeBridge.executeAffirmation(recipient, value, transactionHash, {
        from: validators[0]
      }).should.be.fulfilled
      await homeBridge.executeAffirmation(recipient, value, transactionHash, {
        from: validators[1]
      }).should.be.fulfilled
      await homeBridge.executeAffirmation(recipient, value, transactionHash, {
        from: validators[2]
      }).should.be.fulfilled
      await homeBridge.executeAffirmation(recipient, value, transactionHash, {
        from: validators[3]
      }).should.be.fulfilled
      const { logs } = await homeBridge.executeAffirmation(recipient, value, transactionHash, {
        from: validators[4]
      }).should.be.fulfilled

      // Then
      logsValidator1.length.should.be.equals(1)

      expectEventInLogs(logs, 'SignedForAffirmation', {
        signer: validators[4],
        transactionHash
      })
      expectEventInLogs(logs, 'FeeDistributedFromAffirmation', {
        feeAmount,
        transactionHash
      })
      expectEventInLogs(logs, 'AffirmationCompleted', {
        recipient,
        value,
        transactionHash
      })

      const balanceAfter = toBN(await web3.eth.getBalance(recipient))
      balanceAfter.should.be.bignumber.equal(balanceBefore.add(value.sub(feeAmount)))

      const updatedBalanceRewardAddress1 = toBN(await web3.eth.getBalance(rewards[0]))
      const updatedBalanceRewardAddress2 = toBN(await web3.eth.getBalance(rewards[1]))
      const updatedBalanceRewardAddress3 = toBN(await web3.eth.getBalance(rewards[2]))
      const updatedBalanceRewardAddress4 = toBN(await web3.eth.getBalance(rewards[3]))
      const updatedBalanceRewardAddress5 = toBN(await web3.eth.getBalance(rewards[4]))

      updatedBalanceRewardAddress1.should.be.bignumber.equal(initialBalanceRewardAddress1.add(feePerValidator))
      updatedBalanceRewardAddress2.should.be.bignumber.equal(initialBalanceRewardAddress2.add(feePerValidator))
      updatedBalanceRewardAddress3.should.be.bignumber.equal(initialBalanceRewardAddress3.add(feePerValidator))
      updatedBalanceRewardAddress4.should.be.bignumber.equal(initialBalanceRewardAddress4.add(feePerValidator))
      updatedBalanceRewardAddress5.should.be.bignumber.equal(initialBalanceRewardAddress5.add(feePerValidator))
    })
    it('should distribute fee to max allowed number of validators', async () => {
      // Given
      const owner = accounts[0]
      const validators = createAccounts(web3, MAX_VALIDATORS)
      validators[0] = accounts[2]
      const rewards = createAccounts(web3, MAX_VALIDATORS)
      const requiredSignatures = 1

      const value = halfEther
      // 0.1% fee
      const fee = 0.001
      const feeInWei = ether(fee.toString())
      const notUsedFee = ZERO

      const rewardableValidators = await RewardableValidators.new()
      const homeBridge = await HomeBridge.new()
      const feeManager = await FeeManagerNativeToErc.new()
      await rewardableValidators.initialize(requiredSignatures, validators, rewards, owner, {
        from: owner
      }).should.be.fulfilled
      await homeBridge.rewardableInitialize(
        rewardableValidators.address,
        [oneEther, halfEther, minPerTx],
        gasPrice,
        requireBlockConfirmations,
        [foreignDailyLimit, foreignMaxPerTx],
        owner,
        feeManager.address,
        [notUsedFee, feeInWei],
        decimalShiftZero
      ).should.be.fulfilled
      await homeBridge.sendTransaction({
        from: accounts[0],
        value: halfEther
      }).should.be.fulfilled

      const recipient = '0xf4BEF13F9f4f2B203FAF0C3cBbaAbe1afE056955'

      const transactionHash = '0x806335163828a8eda675cff9c84fa6e6c7cf06bb44cc6ec832e42fe789d01415'

      // When
      const { receipt } = await homeBridge.executeAffirmation(recipient, value, transactionHash, {
        from: validators[0]
      }).should.be.fulfilled
      expect(receipt.gasUsed).to.be.lte(MAX_GAS)
    })
  })

  describe('#feeManager_BothDirections_fallback', () => {
    it('should subtract fee from value', async () => {
      // Initialize
      const user = accounts[0]
      const owner = accounts[9]
      const validators = [accounts[1]]
      const rewards = [accounts[2]]
      const requiredSignatures = 1
      const rewardableValidators = await RewardableValidators.new()
      const homeBridge = await HomeBridge.new()
      await rewardableValidators.initialize(requiredSignatures, validators, rewards, owner, {
        from: owner
      }).should.be.fulfilled
      const feeManager = await FeeManagerNativeToErcBothDirections.new()

      // Given
      // 0.1% fee
      const fee = 0.001
      const feeInWei = ether(fee.toString())
      const value = halfEther

      await homeBridge.rewardableInitialize(
        rewardableValidators.address,
        [oneEther, halfEther, minPerTx],
        gasPrice,
        requireBlockConfirmations,
        [foreignDailyLimit, foreignMaxPerTx],
        owner,
        feeManager.address,
        [feeInWei, feeInWei],
        decimalShiftZero
      ).should.be.fulfilled

      // When
      const { logs } = await homeBridge.sendTransaction({
        from: user,
        value
      }).should.be.fulfilled

      // Then
      const valueCalc = 0.5 * (1 - fee)
      const finalValue = ether(valueCalc.toString())
      expectEventInLogs(logs, 'UserRequestForSignature', {
        recipient: user,
        value: finalValue
      })
    })
  })

  describe('#feeManager_BothDirections_relayRequest', () => {
    it('should subtract fee from value', async () => {
      // Initialize
      const user = accounts[0]
      const user2 = accounts[4]
      const owner = accounts[9]
      const validators = [accounts[1]]
      const rewards = [accounts[2]]
      const requiredSignatures = 1
      const rewardableValidators = await RewardableValidators.new()
      const homeBridge = await HomeBridge.new()
      await rewardableValidators.initialize(requiredSignatures, validators, rewards, owner, {
        from: owner
      }).should.be.fulfilled
      const feeManager = await FeeManagerNativeToErcBothDirections.new()

      // Given
      // 0.1% fee
      const fee = 0.001
      const feeInWei = ether(fee.toString())
      const value = halfEther

      await homeBridge.rewardableInitialize(
        rewardableValidators.address,
        [oneEther, halfEther, minPerTx],
        gasPrice,
        requireBlockConfirmations,
        [foreignDailyLimit, foreignMaxPerTx],
        owner,
        feeManager.address,
        [feeInWei, feeInWei],
        decimalShiftZero
      ).should.be.fulfilled

      // When
      const { logs } = await homeBridge.relayTokens(user2, {
        from: user,
        value
      }).should.be.fulfilled

      // Then
      const valueCalc = 0.5 * (1 - fee)
      const finalValue = ether(valueCalc.toString())
      expectEventInLogs(logs, 'UserRequestForSignature', {
        recipient: user2,
        value: finalValue
      })
    })
  })

  describe('#feeManager_BothDirections_submitSignature', () => {
    it('should distribute fee to validator', async () => {
      // Initialize
      const user = accounts[0]
      const owner = accounts[9]
      const validators = [accounts[1]]
      const rewards = [accounts[2]]
      const requiredSignatures = 1
      const rewardableValidators = await RewardableValidators.new()
      const homeBridge = await HomeBridge.new()
      await rewardableValidators.initialize(requiredSignatures, validators, rewards, owner, {
        from: owner
      }).should.be.fulfilled
      const feeManager = await FeeManagerNativeToErcBothDirections.new()

      // Given
      // 0.1% fee
      const fee = 0.001
      const feeInWei = ether(fee.toString())
      const initialValue = halfEther
      const valueCalc = 0.5 * (1 - fee)
      const value = ether(valueCalc.toString())
      const feeAmountCalc = 0.5 * fee
      const feeAmount = ether(feeAmountCalc.toString())

      const rewardAddressBalanceBefore = toBN(await web3.eth.getBalance(rewards[0]))

      await homeBridge.rewardableInitialize(
        rewardableValidators.address,
        [oneEther, halfEther, minPerTx],
        gasPrice,
        requireBlockConfirmations,
        [foreignDailyLimit, foreignMaxPerTx],
        owner,
        feeManager.address,
        [feeInWei, feeInWei],
        decimalShiftZero
      ).should.be.fulfilled

      await homeBridge.sendTransaction({
        from: user,
        value: initialValue
      }).should.be.fulfilled

      // When
      const transactionHash = '0x1045bfe274b88120a6b1e5d01b5ec00ab5d01098346e90e7c7a3c9b8f0181c80'
      const message = createMessage(user, value, transactionHash, homeBridge.address)
      const signature = await sign(validators[0], message)
      const { logs } = await homeBridge.submitSignature(signature, message, { from: validators[0] }).should.be.fulfilled

      // Then
      logs.length.should.be.equal(3)
      logs[1].event.should.be.equal('CollectedSignatures')
      expectEventInLogs(logs, 'FeeDistributedFromSignatures', {
        feeAmount,
        transactionHash
      })

      const bridgeBalance = toBN(await web3.eth.getBalance(homeBridge.address))
      bridgeBalance.should.be.bignumber.equal(value)

      const rewardAddressBalanceAfter = toBN(await web3.eth.getBalance(rewards[0]))
      rewardAddressBalanceAfter.should.be.bignumber.equal(rewardAddressBalanceBefore.add(feeAmount))
    })
    it('should distribute fee to 3 validators', async () => {
      // Initialize
      const user = accounts[0]
      const owner = accounts[9]
      const validators = [accounts[1], accounts[2], accounts[3]]
      const rewards = [accounts[4], accounts[5], accounts[6]]
      const requiredSignatures = 3
      const rewardableValidators = await RewardableValidators.new()
      const homeBridge = await HomeBridge.new()
      await rewardableValidators.initialize(requiredSignatures, validators, rewards, owner, {
        from: owner
      }).should.be.fulfilled
      const feeManager = await FeeManagerNativeToErcBothDirections.new()

      // Given
      // 0.1% fee
      const fee = 0.001
      const feeInWei = ether(fee.toString())
      const feePerValidator = toBN(166666666666666)
      const feePerValidatorPlusDiff = toBN(166666666666668)
      const initialValue = halfEther
      const valueCalc = 0.5 * (1 - fee)
      const value = ether(valueCalc.toString())
      const feeAmountCalc = 0.5 * fee
      const feeAmount = ether(feeAmountCalc.toString())

      await homeBridge.rewardableInitialize(
        rewardableValidators.address,
        [oneEther, halfEther, minPerTx],
        gasPrice,
        requireBlockConfirmations,
        [foreignDailyLimit, foreignMaxPerTx],
        owner,
        feeManager.address,
        [feeInWei, feeInWei],
        decimalShiftZero
      ).should.be.fulfilled

      await homeBridge.sendTransaction({
        from: user,
        value: initialValue
      }).should.be.fulfilled

      const initialBalanceRewardAddress1 = toBN(await web3.eth.getBalance(rewards[0]))
      const initialBalanceRewardAddress2 = toBN(await web3.eth.getBalance(rewards[1]))
      const initialBalanceRewardAddress3 = toBN(await web3.eth.getBalance(rewards[2]))

      // When
      const transactionHash = '0x1045bfe274b88120a6b1e5d01b5ec00ab5d01098346e90e7c7a3c9b8f0181c80'
      const message = createMessage(user, value, transactionHash, homeBridge.address)
      const signature = await sign(validators[0], message)
      const signature2 = await sign(validators[1], message)
      const signature3 = await sign(validators[2], message)

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

      const updatedBalanceRewardAddress1 = toBN(await web3.eth.getBalance(rewards[0]))
      const updatedBalanceRewardAddress2 = toBN(await web3.eth.getBalance(rewards[1]))
      const updatedBalanceRewardAddress3 = toBN(await web3.eth.getBalance(rewards[2]))

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
      // Initialize
      const user = accounts[0]
      const owner = accounts[9]
      const validators = [accounts[0], accounts[1], accounts[2], accounts[3], accounts[4]]
      const rewards = [accounts[5], accounts[6], accounts[7], accounts[8], accounts[9]]
      const requiredSignatures = 5
      const rewardableValidators = await RewardableValidators.new()
      const homeBridge = await HomeBridge.new()
      await rewardableValidators.initialize(requiredSignatures, validators, rewards, owner, {
        from: owner
      }).should.be.fulfilled
      const feeManager = await FeeManagerNativeToErcBothDirections.new()

      // Given
      // 0.1% fee
      const fee = 0.001
      const feeInWei = ether(fee.toString())
      const initialValue = halfEther
      const valueCalc = 0.5 * (1 - fee)
      const value = ether(valueCalc.toString())
      const feeAmountCalc = 0.5 * fee
      const feeAmount = ether(feeAmountCalc.toString())
      const feePerValidator = feeAmount.div(toBN(5))

      await homeBridge.rewardableInitialize(
        rewardableValidators.address,
        [oneEther, halfEther, minPerTx],
        gasPrice,
        requireBlockConfirmations,
        [foreignDailyLimit, foreignMaxPerTx],
        owner,
        feeManager.address,
        [feeInWei, feeInWei],
        decimalShiftZero
      ).should.be.fulfilled

      await homeBridge.sendTransaction({
        from: user,
        value: initialValue
      }).should.be.fulfilled

      const initialBalanceRewardAddress1 = toBN(await web3.eth.getBalance(rewards[0]))
      const initialBalanceRewardAddress2 = toBN(await web3.eth.getBalance(rewards[1]))
      const initialBalanceRewardAddress3 = toBN(await web3.eth.getBalance(rewards[2]))
      const initialBalanceRewardAddress4 = toBN(await web3.eth.getBalance(rewards[3]))
      const initialBalanceRewardAddress5 = toBN(await web3.eth.getBalance(rewards[4]))

      // When
      const transactionHash = '0x1045bfe274b88120a6b1e5d01b5ec00ab5d01098346e90e7c7a3c9b8f0181c80'
      const message = createMessage(user, value, transactionHash, homeBridge.address)
      const signature = await sign(validators[0], message)
      const signature2 = await sign(validators[1], message)
      const signature3 = await sign(validators[2], message)
      const signature4 = await sign(validators[3], message)
      const signature5 = await sign(validators[4], message)

      await homeBridge.submitSignature(signature, message, { from: validators[0] }).should.be.fulfilled
      await homeBridge.submitSignature(signature2, message, { from: validators[1] }).should.be.fulfilled
      await homeBridge.submitSignature(signature3, message, { from: validators[2] }).should.be.fulfilled
      await homeBridge.submitSignature(signature4, message, { from: validators[3] }).should.be.fulfilled
      const { logs } = await homeBridge.submitSignature(signature5, message, {
        from: validators[4]
      }).should.be.fulfilled

      // Then
      logs.length.should.be.equal(3)
      logs[1].event.should.be.equal('CollectedSignatures')
      expectEventInLogs(logs, 'FeeDistributedFromSignatures', {
        feeAmount,
        transactionHash
      })

      const updatedBalanceRewardAddress1 = toBN(await web3.eth.getBalance(rewards[0]))
      const updatedBalanceRewardAddress2 = toBN(await web3.eth.getBalance(rewards[1]))
      const updatedBalanceRewardAddress3 = toBN(await web3.eth.getBalance(rewards[2]))
      const updatedBalanceRewardAddress4 = toBN(await web3.eth.getBalance(rewards[3]))
      const updatedBalanceRewardAddress5 = toBN(await web3.eth.getBalance(rewards[4]))

      updatedBalanceRewardAddress1.should.be.bignumber.equal(initialBalanceRewardAddress1.add(feePerValidator))
      updatedBalanceRewardAddress2.should.be.bignumber.equal(initialBalanceRewardAddress2.add(feePerValidator))
      updatedBalanceRewardAddress3.should.be.bignumber.equal(initialBalanceRewardAddress3.add(feePerValidator))
      updatedBalanceRewardAddress4.should.be.bignumber.equal(initialBalanceRewardAddress4.add(feePerValidator))
      updatedBalanceRewardAddress5.should.be.bignumber.equal(initialBalanceRewardAddress5.add(feePerValidator))
    })
    it('should distribute fee to max allowed number of validators', async () => {
      // Initialize
      const user = accounts[0]
      const owner = accounts[9]
      const validators = createAccounts(web3, MAX_VALIDATORS)
      validators[0] = accounts[2]
      const rewards = createAccounts(web3, MAX_VALIDATORS)
      const requiredSignatures = 1
      const rewardableValidators = await RewardableValidators.new()
      const homeBridge = await HomeBridge.new()
      await rewardableValidators.initialize(requiredSignatures, validators, rewards, owner, {
        from: owner
      }).should.be.fulfilled
      const feeManager = await FeeManagerNativeToErcBothDirections.new()

      // Given
      // 0.1% fee
      const fee = 0.001
      const feeInWei = ether(fee.toString())
      const initialValue = halfEther
      const valueCalc = 0.5 * (1 - fee)
      const value = ether(valueCalc.toString())

      await homeBridge.rewardableInitialize(
        rewardableValidators.address,
        [oneEther, halfEther, minPerTx],
        gasPrice,
        requireBlockConfirmations,
        [foreignDailyLimit, foreignMaxPerTx],
        owner,
        feeManager.address,
        [feeInWei, feeInWei],
        decimalShiftZero
      ).should.be.fulfilled

      await homeBridge.sendTransaction({
        from: user,
        value: initialValue
      }).should.be.fulfilled

      // When
      const transactionHash = '0x1045bfe274b88120a6b1e5d01b5ec00ab5d01098346e90e7c7a3c9b8f0181c80'
      const message = createMessage(user, value, transactionHash, homeBridge.address)
      const signature = await sign(validators[0], message)

      const { receipt } = await homeBridge.submitSignature(signature, message, {
        from: validators[0]
      }).should.be.fulfilled
      expect(receipt.gasUsed).to.be.lte(MAX_GAS)
    })
  })

  describe('#feeManager_BothDirections_ExecuteAffirmation', async () => {
    it('should distribute fee to validator', async () => {
      // Initialize
      const owner = accounts[9]
      const validators = [accounts[1]]
      const rewards = [accounts[2]]
      const requiredSignatures = 1
      const rewardableValidators = await RewardableValidators.new()
      const homeBridge = await HomeBridge.new()
      await rewardableValidators.initialize(requiredSignatures, validators, rewards, owner, {
        from: owner
      }).should.be.fulfilled
      const feeManager = await FeeManagerNativeToErcBothDirections.new()

      // Given
      // 0.1% fee
      const fee = 0.001
      const feeInWei = ether(fee.toString())
      const value = halfEther
      const valueCalc = 0.5 * (1 - fee)
      const finalUserValue = ether(valueCalc.toString())
      const feeAmountCalc = 0.5 * fee
      const feeAmount = ether(feeAmountCalc.toString())

      await homeBridge.rewardableInitialize(
        rewardableValidators.address,
        [oneEther, halfEther, minPerTx],
        gasPrice,
        requireBlockConfirmations,
        [foreignDailyLimit, foreignMaxPerTx],
        owner,
        feeManager.address,
        [feeInWei, feeInWei],
        decimalShiftZero
      ).should.be.fulfilled
      await homeBridge.sendTransaction({
        from: accounts[0],
        value: halfEther
      }).should.be.fulfilled

      const recipient = accounts[5]
      const balanceBefore = toBN(await web3.eth.getBalance(recipient))
      const rewardAddressBalanceBefore = toBN(await web3.eth.getBalance(rewards[0]))
      const transactionHash = '0x806335163828a8eda675cff9c84fa6e6c7cf06bb44cc6ec832e42fe789d01415'

      // When
      const { logs } = await homeBridge.executeAffirmation(recipient, value, transactionHash, {
        from: validators[0]
      }).should.be.fulfilled

      // Then
      expectEventInLogs(logs, 'SignedForAffirmation', {
        signer: validators[0],
        transactionHash
      })
      expectEventInLogs(logs, 'FeeDistributedFromAffirmation', {
        feeAmount,
        transactionHash
      })
      expectEventInLogs(logs, 'AffirmationCompleted', {
        recipient,
        value,
        transactionHash
      })

      const balanceAfter = toBN(await web3.eth.getBalance(recipient))
      const rewardAddressBalanceAfter = toBN(await web3.eth.getBalance(rewards[0]))

      rewardAddressBalanceAfter.should.be.bignumber.equal(rewardAddressBalanceBefore.add(feeAmount))
      balanceAfter.should.be.bignumber.equal(balanceBefore.add(finalUserValue))
    })
    it('should distribute fee to 3 validators', async () => {
      // Given
      const owner = accounts[9]
      const validators = [accounts[1], accounts[2], accounts[3]]
      const rewards = [accounts[4], accounts[5], accounts[6]]
      const requiredSignatures = 2
      const rewardableValidators = await RewardableValidators.new()

      const value = halfEther
      // 0.1% fee
      const fee = 0.001
      const feeInWei = ether(fee.toString())
      const feePerValidator = toBN(166666666666666)
      const feePerValidatorPlusDiff = toBN(166666666666668)
      const valueCalc = 0.5 * (1 - fee)
      const finalUserValue = ether(valueCalc.toString())
      const feeAmountCalc = 0.5 * fee
      const feeAmount = ether(feeAmountCalc.toString())

      const homeBridge = await HomeBridge.new()
      const feeManager = await FeeManagerNativeToErcBothDirections.new()
      await rewardableValidators.initialize(requiredSignatures, validators, rewards, owner, {
        from: owner
      }).should.be.fulfilled
      await homeBridge.rewardableInitialize(
        rewardableValidators.address,
        [oneEther, halfEther, minPerTx],
        gasPrice,
        requireBlockConfirmations,
        [foreignDailyLimit, foreignMaxPerTx],
        owner,
        feeManager.address,
        [feeInWei, feeInWei],
        decimalShiftZero
      ).should.be.fulfilled
      await homeBridge.sendTransaction({
        from: accounts[0],
        value: halfEther
      }).should.be.fulfilled

      const recipient = accounts[8]
      const balanceBefore = toBN(await web3.eth.getBalance(recipient))

      const initialBalanceRewardAddress1 = toBN(await web3.eth.getBalance(rewards[0]))
      const initialBalanceRewardAddress2 = toBN(await web3.eth.getBalance(rewards[1]))
      const initialBalanceRewardAddress3 = toBN(await web3.eth.getBalance(rewards[2]))

      const transactionHash = '0x806335163828a8eda675cff9c84fa6e6c7cf06bb44cc6ec832e42fe789d01415'

      // When
      const { logs: logsValidator1 } = await homeBridge.executeAffirmation(recipient, value, transactionHash, {
        from: validators[0]
      }).should.be.fulfilled
      const { logs } = await homeBridge.executeAffirmation(recipient, value, transactionHash, {
        from: validators[1]
      }).should.be.fulfilled

      // Then
      logsValidator1.length.should.be.equals(1)

      expectEventInLogs(logs, 'SignedForAffirmation', {
        signer: validators[1],
        transactionHash
      })
      expectEventInLogs(logs, 'FeeDistributedFromAffirmation', {
        feeAmount,
        transactionHash
      })
      expectEventInLogs(logs, 'AffirmationCompleted', {
        recipient,
        value,
        transactionHash
      })

      const balanceAfter = toBN(await web3.eth.getBalance(recipient))
      balanceAfter.should.be.bignumber.equal(balanceBefore.add(finalUserValue))

      const updatedBalanceRewardAddress1 = toBN(await web3.eth.getBalance(rewards[0]))
      const updatedBalanceRewardAddress2 = toBN(await web3.eth.getBalance(rewards[1]))
      const updatedBalanceRewardAddress3 = toBN(await web3.eth.getBalance(rewards[2]))

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

      const homeBridgeBalance = toBN(await web3.eth.getBalance(homeBridge.address))
      homeBridgeBalance.should.be.bignumber.equal('0')
    })
    it('should distribute fee to 5 validators', async () => {
      // Given
      const owner = accounts[0]
      const validators = [accounts[0], accounts[1], accounts[2], accounts[3], accounts[4]]
      const rewards = [accounts[5], accounts[6], accounts[7], accounts[8], accounts[9]]
      const requiredSignatures = 5

      const value = halfEther
      // 0.1% fee
      const fee = 0.001
      const feeInWei = ether(fee.toString())
      const feeAmountCalc = 0.5 * fee
      const feeAmount = ether(feeAmountCalc.toString())
      const feePerValidator = feeAmount.div(toBN(5))

      const rewardableValidators = await RewardableValidators.new()
      const homeBridge = await HomeBridge.new()
      const feeManager = await FeeManagerNativeToErcBothDirections.new()
      await rewardableValidators.initialize(requiredSignatures, validators, rewards, owner, {
        from: owner
      }).should.be.fulfilled
      await homeBridge.rewardableInitialize(
        rewardableValidators.address,
        [oneEther, halfEther, minPerTx],
        gasPrice,
        requireBlockConfirmations,
        [foreignDailyLimit, foreignMaxPerTx],
        owner,
        feeManager.address,
        [feeInWei, feeInWei],
        decimalShiftZero
      ).should.be.fulfilled
      await homeBridge.sendTransaction({
        from: accounts[0],
        value: halfEther
      }).should.be.fulfilled

      const recipient = '0xf4BEF13F9f4f2B203FAF0C3cBbaAbe1afE056955'
      const balanceBefore = toBN(await web3.eth.getBalance(recipient))

      const initialBalanceRewardAddress1 = toBN(await web3.eth.getBalance(rewards[0]))
      const initialBalanceRewardAddress2 = toBN(await web3.eth.getBalance(rewards[1]))
      const initialBalanceRewardAddress3 = toBN(await web3.eth.getBalance(rewards[2]))
      const initialBalanceRewardAddress4 = toBN(await web3.eth.getBalance(rewards[3]))
      const initialBalanceRewardAddress5 = toBN(await web3.eth.getBalance(rewards[4]))

      const transactionHash = '0x806335163828a8eda675cff9c84fa6e6c7cf06bb44cc6ec832e42fe789d01415'

      // When
      const { logs: logsValidator1 } = await homeBridge.executeAffirmation(recipient, value, transactionHash, {
        from: validators[0]
      }).should.be.fulfilled
      await homeBridge.executeAffirmation(recipient, value, transactionHash, {
        from: validators[1]
      }).should.be.fulfilled
      await homeBridge.executeAffirmation(recipient, value, transactionHash, {
        from: validators[2]
      }).should.be.fulfilled
      await homeBridge.executeAffirmation(recipient, value, transactionHash, {
        from: validators[3]
      }).should.be.fulfilled
      const { logs } = await homeBridge.executeAffirmation(recipient, value, transactionHash, {
        from: validators[4]
      }).should.be.fulfilled

      // Then
      logsValidator1.length.should.be.equals(1)

      expectEventInLogs(logs, 'SignedForAffirmation', {
        signer: validators[4],
        transactionHash
      })
      expectEventInLogs(logs, 'FeeDistributedFromAffirmation', {
        feeAmount,
        transactionHash
      })
      expectEventInLogs(logs, 'AffirmationCompleted', {
        recipient,
        value,
        transactionHash
      })

      const balanceAfter = toBN(await web3.eth.getBalance(recipient))
      balanceAfter.should.be.bignumber.equal(balanceBefore.add(value.sub(feeAmount)))

      const updatedBalanceRewardAddress1 = toBN(await web3.eth.getBalance(rewards[0]))
      const updatedBalanceRewardAddress2 = toBN(await web3.eth.getBalance(rewards[1]))
      const updatedBalanceRewardAddress3 = toBN(await web3.eth.getBalance(rewards[2]))
      const updatedBalanceRewardAddress4 = toBN(await web3.eth.getBalance(rewards[3]))
      const updatedBalanceRewardAddress5 = toBN(await web3.eth.getBalance(rewards[4]))

      updatedBalanceRewardAddress1.should.be.bignumber.equal(initialBalanceRewardAddress1.add(feePerValidator))
      updatedBalanceRewardAddress2.should.be.bignumber.equal(initialBalanceRewardAddress2.add(feePerValidator))
      updatedBalanceRewardAddress3.should.be.bignumber.equal(initialBalanceRewardAddress3.add(feePerValidator))
      updatedBalanceRewardAddress4.should.be.bignumber.equal(initialBalanceRewardAddress4.add(feePerValidator))
      updatedBalanceRewardAddress5.should.be.bignumber.equal(initialBalanceRewardAddress5.add(feePerValidator))
    })
    it('should distribute fee to max allowed number of validators', async () => {
      // Given
      const owner = accounts[0]
      const validators = createAccounts(web3, MAX_VALIDATORS)
      validators[0] = accounts[2]
      const rewards = createAccounts(web3, MAX_VALIDATORS)
      const requiredSignatures = 1

      const value = halfEther
      // 0.1% fee
      const fee = 0.001
      const feeInWei = ether(fee.toString())

      const rewardableValidators = await RewardableValidators.new()
      const homeBridge = await HomeBridge.new()
      const feeManager = await FeeManagerNativeToErcBothDirections.new()
      await rewardableValidators.initialize(requiredSignatures, validators, rewards, owner, {
        from: owner
      }).should.be.fulfilled
      await homeBridge.rewardableInitialize(
        rewardableValidators.address,
        [oneEther, halfEther, minPerTx],
        gasPrice,
        requireBlockConfirmations,
        [foreignDailyLimit, foreignMaxPerTx],
        owner,
        feeManager.address,
        [feeInWei, feeInWei],
        decimalShiftZero
      ).should.be.fulfilled
      await homeBridge.sendTransaction({
        from: accounts[0],
        value: halfEther
      }).should.be.fulfilled

      const recipient = '0xf4BEF13F9f4f2B203FAF0C3cBbaAbe1afE056955'

      const transactionHash = '0x806335163828a8eda675cff9c84fa6e6c7cf06bb44cc6ec832e42fe789d01415'

      const { receipt } = await homeBridge.executeAffirmation(recipient, value, transactionHash, {
        from: validators[0]
      }).should.be.fulfilled
      expect(receipt.gasUsed).to.be.lte(MAX_GAS)
    })
  })
  describe('#decimalShift', async () => {
    for (const decimalShift of [2, -1]) {
      it(`Foreign to Home: works with 5 validators and 3 required signatures with decimal shift ${decimalShift}`, async () => {
        const recipient = accounts[8]
        const authoritiesFiveAccs = [accounts[1], accounts[2], accounts[3], accounts[4], accounts[5]]
        const ownerOfValidators = accounts[0]
        const validatorContractWith3Signatures = await BridgeValidators.new()
        await validatorContractWith3Signatures.initialize(3, authoritiesFiveAccs, ownerOfValidators)

        const homeBridgeWithThreeSigs = await HomeBridge.new()
        await homeBridgeWithThreeSigs.initialize(
          validatorContractWith3Signatures.address,
          [oneEther, halfEther, minPerTx],
          gasPrice,
          requireBlockConfirmations,
          [foreignDailyLimit, foreignMaxPerTx],
          owner,
          decimalShift
        )

        const valueOnForeign = toBN('1000')
        const valueOnHome = toBN(valueOnForeign * 10 ** decimalShift)
        const transactionHash = '0x806335163828a8eda675cff9c84fa6e6c7cf06bb44cc6ec832e42fe789d01415'

        await homeBridgeWithThreeSigs.sendTransaction({
          from: recipient,
          value: halfEther
        }).should.be.fulfilled

        const balanceBeforeRecipient = toBN(await web3.eth.getBalance(recipient))

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

        const balanceAfterRecipient = toBN(await web3.eth.getBalance(recipient))
        balanceAfterRecipient.should.be.bignumber.equal(balanceBeforeRecipient.add(valueOnHome))
      })
      it(`Foreign to Home: test decimal shift ${decimalShift}, no impact on UserRequestForSignature value`, async () => {
        homeContract = await HomeBridge.new()
        await homeContract.initialize(
          validatorContract.address,
          ['3', '2', '1'],
          gasPrice,
          requireBlockConfirmations,
          [foreignDailyLimit, foreignMaxPerTx],
          owner,
          decimalShift
        )
        const currentDay = await homeContract.getCurrentDay()
        expect(await homeContract.totalSpentPerDay(currentDay)).to.be.bignumber.equal(ZERO)

        const { logs } = await homeContract.sendTransaction({
          from: accounts[1],
          value: 1
        }).should.be.fulfilled
        expect(await homeContract.totalSpentPerDay(currentDay)).to.be.bignumber.equal('1')

        expectEventInLogs(logs, 'UserRequestForSignature', { recipient: accounts[1], value: toBN(1) })

        await homeContract
          .sendTransaction({
            from: accounts[1],
            value: 3
          })
          .should.be.rejectedWith(ERROR_MSG)

        await homeContract.setDailyLimit(4).should.be.fulfilled
        await homeContract.sendTransaction({
          from: accounts[1],
          value: 1
        }).should.be.fulfilled

        expect(await homeContract.totalSpentPerDay(currentDay)).to.be.bignumber.equal('2')
      })
    }
  })
})
