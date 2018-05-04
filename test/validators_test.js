const BridgeValidators = artifacts.require("BridgeValidators.sol");
const EternalStorageProxy = artifacts.require("EternalStorageProxy.sol");
const {ERROR_MSG, ERROR_MSG_OPCODE, ZERO_ADDRESS} = require('./setup');

contract('BridgeValidators', async (accounts) => {
  let token
  let owner = accounts[0]
  const user = accounts[1];
  beforeEach(async () => {
    bridgeValidators = await BridgeValidators.new();
  })
  describe('#initialize', async () => {
    it('sets values', async () => {
      // function initialize(uint256 _requiredSignatures, address[] _initialValidators, address _owner) public {
      '0x0000000000000000000000000000000000000000'.should.be.equal(await bridgeValidators.owner.call())
      '0'.should.be.bignumber.equal(await bridgeValidators.validatorCount.call())
      false.should.be.equal(await bridgeValidators.isValidator.call(accounts[0]))
      false.should.be.equal(await bridgeValidators.isValidator.call(accounts[1]))
      false.should.be.equal(await bridgeValidators.isInitialized.call())
      '0'.should.be.bignumber.equal(await bridgeValidators.requiredSignatures.call())
      await bridgeValidators.initialize(3, [accounts[0], accounts[1]], accounts[2], {from: accounts[2]}).should.be.rejectedWith(ERROR_MSG)
      await bridgeValidators.initialize(2, [accounts[0], accounts[1]], accounts[2], {from: accounts[2]}).should.be.fulfilled;
      await bridgeValidators.initialize(2, [accounts[0], accounts[1]], accounts[2], {from: accounts[2]}).should.be.rejectedWith(ERROR_MSG);
      true.should.be.equal(await bridgeValidators.isInitialized.call())
      '2'.should.be.bignumber.equal(await bridgeValidators.requiredSignatures.call())
      true.should.be.equal(await bridgeValidators.isValidator.call(accounts[0]))
      true.should.be.equal(await bridgeValidators.isValidator.call(accounts[1]))
      accounts[2].should.be.equal(await bridgeValidators.owner.call())
      '2'.should.be.bignumber.equal(await bridgeValidators.validatorCount.call())
    })
  })

  describe('#addValidator', async () => {
    let owner = accounts[2];
    let validators = [accounts[0], accounts[1]];
    let requiredSignatures = 2;
    beforeEach(async () => {
      await bridgeValidators.initialize(requiredSignatures, validators, owner, {from: owner}).should.be.fulfilled
      '2'.should.be.bignumber.equal(await bridgeValidators.validatorCount.call())
    })
    it('adds validator', async () => {
      let newValidator = accounts[3];

      false.should.be.equal(await bridgeValidators.isValidator.call(newValidator))
      await bridgeValidators.addValidator(newValidator, {from: validators[0]}).should.be.rejectedWith(ERROR_MSG)
      const {logs} = await bridgeValidators.addValidator(newValidator, {from: owner}).should.be.fulfilled
      true.should.be.equal(await bridgeValidators.isValidator.call(newValidator))
      '3'.should.be.bignumber.equal(await bridgeValidators.validatorCount.call())
      logs[0].event.should.be.equal('ValidatorAdded')
      logs[0].args.should.be.deep.equal({validator: newValidator})
    })

    it('cannot add already existing validator', async () => {
      true.should.be.equal(await bridgeValidators.isValidator.call(validators[0]))
      await bridgeValidators.addValidator(validators[0], {from: owner}).should.be.rejectedWith(ERROR_MSG_OPCODE)
      await bridgeValidators.addValidator(ZERO_ADDRESS, {from: owner}).should.be.rejectedWith(ERROR_MSG)
      '2'.should.be.bignumber.equal(await bridgeValidators.validatorCount.call())
    })
  })

  describe('#removeValidator', async () => {
    let owner = accounts[2];
    let validators = [accounts[0], accounts[1], accounts[3]];
    let requiredSignatures = 2;
    beforeEach(async () => {
      await bridgeValidators.initialize(requiredSignatures, validators, owner, {from: owner}).should.be.fulfilled
      '3'.should.be.bignumber.equal(await bridgeValidators.validatorCount.call())
    })

    it('removes validator', async () => {
      let toRemove = validators[0];
      true.should.be.equal(await bridgeValidators.isValidator.call(toRemove))
      await bridgeValidators.removeValidator(toRemove, {from: validators[0]}).should.be.rejectedWith(ERROR_MSG)
      const {logs} = await bridgeValidators.removeValidator(toRemove, {from: owner}).should.be.fulfilled
      false.should.be.equal(await bridgeValidators.isValidator.call(toRemove))
      '2'.should.be.bignumber.equal(await bridgeValidators.validatorCount.call())
      logs[0].event.should.be.equal('ValidatorRemoved')
      logs[0].args.should.be.deep.equal({validator: toRemove})
    })

    it('cannot remove if it will break requiredSignatures', async () => {
      let toRemove = validators[0];
      let toRemove2 = validators[1];
      true.should.be.equal(await bridgeValidators.isValidator.call(toRemove))
      true.should.be.equal(await bridgeValidators.isValidator.call(toRemove))
      await bridgeValidators.removeValidator(toRemove, {from: owner}).should.be.fulfilled
      await bridgeValidators.removeValidator(toRemove2, {from: owner}).should.be.rejectedWith(ERROR_MSG)
      false.should.be.equal(await bridgeValidators.isValidator.call(toRemove))
      true.should.be.equal(await bridgeValidators.isValidator.call(toRemove2))
      '2'.should.be.bignumber.equal(await bridgeValidators.validatorCount.call())
    })

    it('cannot remove non-existent validator', async () => {
      false.should.be.equal(await bridgeValidators.isValidator.call(accounts[4]))
      await bridgeValidators.removeValidator(accounts[4], {from: owner}).should.be.rejectedWith(ERROR_MSG)
      await bridgeValidators.removeValidator(ZERO_ADDRESS, {from: owner}).should.be.rejectedWith(ERROR_MSG)
      '3'.should.be.bignumber.equal(await bridgeValidators.validatorCount.call())
    })
  })

  describe('#setRequiredSignatures', async () => {
    let owner = accounts[2];
    let validators = [accounts[0], accounts[1], accounts[3]];
    let requiredSignatures = 2;
    beforeEach(async () => {
      await bridgeValidators.initialize(requiredSignatures, validators, owner, {from: owner}).should.be.fulfilled
      '3'.should.be.bignumber.equal(await bridgeValidators.validatorCount.call())
    })

    it('sets req signatures', async () => {
      let newReqSig = 3;
      requiredSignatures.should.be.bignumber.equal(await bridgeValidators.requiredSignatures.call());
      await bridgeValidators.setRequiredSignatures(newReqSig, {from: validators[0]}).should.be.rejectedWith(ERROR_MSG)
      await bridgeValidators.setRequiredSignatures(newReqSig, {from: owner}).should.be.fulfilled
      newReqSig.should.be.bignumber.equal(await bridgeValidators.requiredSignatures.call());
    })
    it('cannot set more than validators count', async () => {
      let newReqSig = 4;
      requiredSignatures.should.be.bignumber.equal(await bridgeValidators.requiredSignatures.call());
      await bridgeValidators.setRequiredSignatures(newReqSig, {from: owner}).should.be.rejectedWith(ERROR_MSG)
      requiredSignatures.should.be.bignumber.equal(await bridgeValidators.requiredSignatures.call());
    })
  })
  describe('#upgradable', async () => {
    it('can be upgraded via upgradeToAndCall', async () => {
      let storageProxy = await EternalStorageProxy.new().should.be.fulfilled;
      let required_signatures = 2;
      let validators = [accounts[0], accounts[1]];
      let owner = accounts[2]
      let data = bridgeValidators.initialize.request(required_signatures, validators, owner).params[0].data
      await storageProxy.upgradeToAndCall('0', bridgeValidators.address, data).should.be.fulfilled;
      let finalContract = await BridgeValidators.at(storageProxy.address);
      true.should.be.equal(await finalContract.isInitialized.call());
      required_signatures.should.be.bignumber.equal(await finalContract.requiredSignatures.call())

      true.should.be.equal(await finalContract.isValidator.call(validators[0]))
      true.should.be.equal(await finalContract.isValidator.call(validators[1]))
      owner.should.be.equal(await finalContract.owner.call())
      validators.length.should.be.bignumber.equal(await finalContract.validatorCount.call())
    })
  })
})
