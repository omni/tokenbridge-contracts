const BridgeValidators = artifacts.require('BridgeValidators.sol')
const EternalStorageProxy = artifacts.require('EternalStorageProxy.sol')

const { expect } = require('chai')
const { ERROR_MSG, ZERO_ADDRESS, F_ADDRESS, BN } = require('./setup')
const { expectEventInLogs, createAccounts } = require('./helpers/helpers')

const MAX_GAS = 8000000
const MAX_VALIDATORS = 50
const ZERO = new BN(0)

contract('BridgeValidators', async accounts => {
  let bridgeValidators
  const owner = accounts[0]

  beforeEach(async () => {
    bridgeValidators = await BridgeValidators.new()
  })

  describe('#initialize', async () => {
    it('sets values', async () => {
      expect(await bridgeValidators.owner()).to.be.equal(ZERO_ADDRESS)
      expect(await bridgeValidators.validatorCount()).to.be.bignumber.equal(ZERO)
      expect(await bridgeValidators.isValidator(accounts[0])).to.be.equal(false)
      expect(await bridgeValidators.isValidator(accounts[1])).to.be.equal(false)
      expect(await bridgeValidators.isInitialized()).to.be.equal(false)
      expect(await bridgeValidators.requiredSignatures()).to.be.bignumber.equal(ZERO)
      expect(await bridgeValidators.deployedAtBlock()).to.be.bignumber.equal(ZERO)

      await bridgeValidators
        .initialize(1, [ZERO_ADDRESS], accounts[1], { from: accounts[1] })
        .should.be.rejectedWith(ERROR_MSG)
      await bridgeValidators
        .initialize(1, [F_ADDRESS], accounts[1], { from: accounts[1] })
        .should.be.rejectedWith(ERROR_MSG)
      await bridgeValidators.initialize(2, accounts.slice(0, 2), accounts[2], { from: accounts[2] }).should.be.fulfilled
      await bridgeValidators
        .initialize(2, accounts.slice(0, 2), accounts[2], { from: accounts[2] })
        .should.be.rejectedWith(ERROR_MSG)

      expect(await bridgeValidators.isInitialized()).to.be.equal(true)
      expect(await bridgeValidators.requiredSignatures()).to.be.bignumber.equal('2')
      expect(await bridgeValidators.isValidator(accounts[0])).to.be.equal(true)
      expect(await bridgeValidators.isValidator(accounts[1])).to.be.equal(true)
      expect(await bridgeValidators.owner()).to.be.equal(accounts[2])
      expect(await bridgeValidators.validatorCount()).to.be.bignumber.equal('2')
      expect(await bridgeValidators.deployedAtBlock()).to.be.bignumber.above(ZERO)
      const { major, minor, patch } = await bridgeValidators.getBridgeValidatorsInterfacesVersion()
      expect(major).to.be.bignumber.gte(ZERO)
      expect(minor).to.be.bignumber.gte(ZERO)
      expect(patch).to.be.bignumber.gte(ZERO)
    })
    it('should fail if exceed amount of validators', async () => {
      // Given
      const validators = createAccounts(web3, MAX_VALIDATORS + 1)

      // When
      await bridgeValidators
        .initialize(MAX_VALIDATORS - 1, validators, accounts[2], { from: accounts[2] })
        .should.be.rejectedWith(ERROR_MSG)
    })

    it('should be able to operate with max allowed number of validators', async () => {
      // Given
      const validators = createAccounts(web3, MAX_VALIDATORS)

      // When
      const { receipt } = await bridgeValidators.initialize(MAX_VALIDATORS - 1, validators, accounts[2], {
        from: accounts[2]
      }).should.be.fulfilled

      expect(receipt.gasUsed).to.be.lte(MAX_GAS)
      expect(await bridgeValidators.validatorCount()).to.be.bignumber.equal(`${MAX_VALIDATORS}`)

      // removing last validator from list (the highest gas consumption)
      await bridgeValidators.removeValidator(validators[MAX_VALIDATORS - 1], { from: accounts[2] }).should.be.fulfilled

      expect(await bridgeValidators.validatorCount()).to.be.bignumber.equal(`${MAX_VALIDATORS - 1}`)
    })
  })

  describe('#addValidator', async () => {
    const owner = accounts[2]
    const validators = [accounts[0], accounts[1]]
    const requiredSignatures = 2
    beforeEach(async () => {
      await bridgeValidators.initialize(requiredSignatures, validators, owner, { from: owner }).should.be.fulfilled
      expect(await bridgeValidators.validatorCount()).to.be.bignumber.equal('2')
    })
    it('adds validator', async () => {
      const newValidator = accounts[4]

      false.should.be.equal(await bridgeValidators.isValidator(newValidator))
      await bridgeValidators.addValidator(newValidator, { from: validators[0] }).should.be.rejectedWith(ERROR_MSG)
      const { logs } = await bridgeValidators.addValidator(newValidator, { from: owner }).should.be.fulfilled
      expect(await bridgeValidators.isValidator(newValidator)).to.be.equal(true)
      expect(await bridgeValidators.validatorCount()).to.be.bignumber.equal('3')
      expectEventInLogs(logs, 'ValidatorAdded', { validator: newValidator })
    })

    it('cannot add already existing validator', async () => {
      true.should.be.equal(await bridgeValidators.isValidator(validators[0]))
      await bridgeValidators.addValidator(validators[0], { from: owner }).should.be.rejectedWith(ERROR_MSG)
      expect(await bridgeValidators.validatorCount()).to.be.bignumber.equal('2')
    })

    it(`cannot add 0xf as validator address`, async () => {
      // Given
      await bridgeValidators.addValidator(F_ADDRESS, { from: owner }).should.be.rejectedWith(ERROR_MSG)
    })

    it(`cannot add 0x0 as validator address`, async () => {
      await bridgeValidators.addValidator(ZERO_ADDRESS, { from: owner }).should.be.rejectedWith(ERROR_MSG)
    })
  })

  describe('#removeValidator', async () => {
    const owner = accounts[2]
    const validators = [accounts[0], accounts[1], accounts[3]]
    const requiredSignatures = 2
    beforeEach(async () => {
      await bridgeValidators.initialize(requiredSignatures, validators, owner, { from: owner }).should.be.fulfilled
      expect(await bridgeValidators.validatorCount()).to.be.bignumber.equal('3')
    })

    it('removes validator', async () => {
      const toRemove = validators[0]
      expect(await bridgeValidators.isValidator(toRemove)).to.be.equal(true)
      await bridgeValidators.removeValidator(toRemove, { from: validators[0] }).should.be.rejectedWith(ERROR_MSG)
      const { logs } = await bridgeValidators.removeValidator(toRemove, { from: owner }).should.be.fulfilled
      expect(await bridgeValidators.isValidator(toRemove)).to.be.equal(false)
      expect(await bridgeValidators.validatorCount()).to.be.bignumber.equal('2')
      expectEventInLogs(logs, 'ValidatorRemoved', { validator: toRemove })
    })

    it('cannot remove if it will break requiredSignatures', async () => {
      const toRemove = validators[0]
      const toRemove2 = validators[1]
      true.should.be.equal(await bridgeValidators.isValidator(toRemove))
      true.should.be.equal(await bridgeValidators.isValidator(toRemove))
      await bridgeValidators.removeValidator(toRemove, { from: owner }).should.be.fulfilled
      await bridgeValidators.removeValidator(toRemove2, { from: owner }).should.be.rejectedWith(ERROR_MSG)
      false.should.be.equal(await bridgeValidators.isValidator(toRemove))
      true.should.be.equal(await bridgeValidators.isValidator(toRemove2))
      expect(await bridgeValidators.validatorCount()).to.be.bignumber.equal('2')
    })

    it('cannot remove non-existent validator', async () => {
      false.should.be.equal(await bridgeValidators.isValidator(accounts[4]))
      await bridgeValidators.removeValidator(accounts[4], { from: owner }).should.be.rejectedWith(ERROR_MSG)
      await bridgeValidators.removeValidator(ZERO_ADDRESS, { from: owner }).should.be.rejectedWith(ERROR_MSG)
      expect(await bridgeValidators.validatorCount()).to.be.bignumber.equal('3')
    })
  })

  describe('#setRequiredSignatures', async () => {
    const owner = accounts[2]
    const validators = [accounts[0], accounts[1], accounts[3]]
    const requiredSignatures = '2'
    beforeEach(async () => {
      await bridgeValidators.initialize(requiredSignatures, validators, owner, { from: owner }).should.be.fulfilled
      expect(await bridgeValidators.validatorCount()).to.be.bignumber.equal('3')
    })

    it('sets req signatures', async () => {
      const newReqSig = '3'
      expect(await bridgeValidators.requiredSignatures()).to.be.bignumber.equal(requiredSignatures)
      await bridgeValidators.setRequiredSignatures(newReqSig, { from: validators[0] }).should.be.rejectedWith(ERROR_MSG)
      await bridgeValidators.setRequiredSignatures(newReqSig, { from: owner }).should.be.fulfilled
      expect(await bridgeValidators.requiredSignatures()).to.be.bignumber.equal(newReqSig)
    })
    it('cannot set more than  validators count', async () => {
      const newReqSig = '4'
      expect(await bridgeValidators.requiredSignatures()).to.be.bignumber.equal(requiredSignatures)
      await bridgeValidators.setRequiredSignatures(newReqSig, { from: owner }).should.be.rejectedWith(ERROR_MSG)
      expect(await bridgeValidators.requiredSignatures()).to.be.bignumber.equal(requiredSignatures)
    })
  })

  describe('#upgradable', async () => {
    it('can be upgraded via upgradeToAndCall', async () => {
      const storageProxy = await EternalStorageProxy.new({
        from: accounts[0]
      }).should.be.fulfilled
      const requiredSignatures = '2'
      const validators = [accounts[0], accounts[1]]
      const owner = accounts[2]
      const data = bridgeValidators.contract.methods.initialize(requiredSignatures, validators, owner).encodeABI()
      await storageProxy
        .upgradeToAndCall('1', bridgeValidators.address, data, {
          from: accounts[1]
        })
        .should.be.rejectedWith(ERROR_MSG)
      await storageProxy.upgradeToAndCall('1', bridgeValidators.address, data, {
        from: accounts[0]
      }).should.be.fulfilled
      const finalContract = await BridgeValidators.at(storageProxy.address)
      true.should.be.equal(await finalContract.isInitialized())
      expect(await finalContract.requiredSignatures()).to.be.bignumber.equal(requiredSignatures)

      true.should.be.equal(await finalContract.isValidator(validators[0]))
      true.should.be.equal(await finalContract.isValidator(validators[1]))
      owner.should.be.equal(await finalContract.owner())
      expect(await finalContract.validatorCount()).to.be.bignumber.equal(validators.length.toString())
    })
  })

  describe('#single list remove', () => {
    it(`should remove ${accounts[0]} - without Proxy`, async () => {
      // Given
      const { initialize, isInitialized, removeValidator } = bridgeValidators
      await initialize(1, accounts.slice(0, 2), owner, { from: owner }).should.be.fulfilled
      true.should.be.equal(await isInitialized())

      // When
      const { logs } = await removeValidator(accounts[0], { from: owner }).should.be.fulfilled

      // Then
      expectEventInLogs(logs, 'ValidatorRemoved', { validator: accounts[0] })
    })

    it(`Removed validator should return zero address on nextValidator`, async () => {
      // Given
      const { initialize, isInitialized, removeValidator, getNextValidator } = bridgeValidators
      await initialize(1, accounts.slice(0, 2), owner, { from: owner }).should.be.fulfilled
      true.should.be.equal(await isInitialized())
      const initialNextValidator = await getNextValidator(accounts[0])

      // When
      const { logs } = await removeValidator(accounts[0], { from: owner }).should.be.fulfilled

      // Then
      expectEventInLogs(logs, 'ValidatorRemoved', { validator: accounts[0] })

      const updatedNextValidator = await getNextValidator(accounts[0])

      initialNextValidator.should.be.equals(accounts[1])
      updatedNextValidator.should.be.equals(ZERO_ADDRESS)
    })

    accounts.slice(0, 5).forEach(validator => {
      it(`should remove ${validator} - with Proxy`, async () => {
        // Given
        const proxy = await EternalStorageProxy.new({
          from: owner
        })
        const bridgeValidatorsImpl = await BridgeValidators.new()
        await proxy.upgradeTo('1', bridgeValidatorsImpl.address)
        bridgeValidators = await BridgeValidators.at(proxy.address)
        const { initialize, isInitialized, removeValidator } = bridgeValidators
        await initialize(1, accounts.slice(0, 5), owner, { from: accounts[1] }).should.be.rejectedWith(ERROR_MSG)
        await initialize(1, accounts.slice(0, 5), owner, { from: owner }).should.be.fulfilled
        true.should.be.equal(await isInitialized())

        // When
        const { logs } = await removeValidator(validator, { from: owner }).should.be.fulfilled

        // Then
        expectEventInLogs(logs, 'ValidatorRemoved', { validator })
      })
    })
  })

  describe('#Validators list', () => {
    it('should return validators list', async () => {
      // Given
      const validators = accounts.slice(0, 5)
      const { initialize, validatorList } = bridgeValidators
      await initialize(1, validators, owner, { from: owner }).should.be.fulfilled

      // When
      const returnedList = await validatorList()

      // Then
      returnedList.should.be.eql(validators)
    })
  })
  describe('#isValidatorDuty', () => {
    it('should return if provided valdidator is on duty', async () => {
      // Given
      const validators = accounts.slice(0, 5)
      const { initialize, isValidatorDuty } = bridgeValidators
      await initialize(1, validators, owner, { from: owner }).should.be.fulfilled

      // When
      const results = await Promise.all(validators.map(v => isValidatorDuty(v)))

      // Then
      expect(results.filter(r => r === true).length).to.be.equal(1)
    })
  })
})
